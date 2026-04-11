#!/usr/bin/env python3
"""Create a Volcengine ECS instance for Neo project deployment."""

import datetime
import hashlib
import hmac
import json
import os
import sys
import urllib.parse
import urllib.request

AK = os.environ.get("VOLC_ACCESSKEY", "")
SK = os.environ.get("VOLC_SECRETKEY", "")
REGION = "cn-beijing"
HOST = "open.volcengineapi.com"


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def volc_api(service: str, action: str, version: str, params: dict | None = None) -> dict:
    now = datetime.datetime.now(datetime.UTC)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")

    query = {"Action": action, "Version": version, **(params or {})}
    qs = urllib.parse.urlencode(sorted(query.items()))

    payload_hash = hashlib.sha256(b"").hexdigest()
    headers_map = {"host": HOST, "x-date": amz_date, "x-content-sha256": payload_hash}
    signed_headers = ";".join(sorted(headers_map))
    canonical_headers = "".join(f"{k}:{v}\n" for k, v in sorted(headers_map.items()))
    canonical = f"GET\n/\n{qs}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"

    scope = f"{date_stamp}/{REGION}/{service}/request"
    sts = f"HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"
    k = _sign(SK.encode(), date_stamp)
    k = _sign(k, REGION)
    k = _sign(k, service)
    k = _sign(k, "request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"HMAC-SHA256 Credential={AK}/{scope}, SignedHeaders={signed_headers}, Signature={sig}"

    req = urllib.request.Request(f"https://{HOST}/?{qs}", headers={
        "Host": HOST, "X-Date": amz_date, "X-Content-Sha256": payload_hash, "Authorization": auth,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return json.loads(body) if body.startswith("{") else {"HTTPError": e.code, "Body": body}


def volc_api_post(service: str, action: str, version: str, body: dict | None = None) -> dict:
    now = datetime.datetime.now(datetime.UTC)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")

    query = {"Action": action, "Version": version}
    qs = urllib.parse.urlencode(sorted(query.items()))

    payload = json.dumps(body or {}).encode()
    payload_hash = hashlib.sha256(payload).hexdigest()
    ct = "application/json"
    headers_map = {"content-type": ct, "host": HOST, "x-date": amz_date, "x-content-sha256": payload_hash}
    signed_headers = ";".join(sorted(headers_map))
    canonical_headers = "".join(f"{k}:{v}\n" for k, v in sorted(headers_map.items()))
    canonical = f"POST\n/\n{qs}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"

    scope = f"{date_stamp}/{REGION}/{service}/request"
    sts = f"HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"
    k = _sign(SK.encode(), date_stamp)
    k = _sign(k, REGION)
    k = _sign(k, service)
    k = _sign(k, "request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    auth = f"HMAC-SHA256 Credential={AK}/{scope}, SignedHeaders={signed_headers}, Signature={sig}"

    req = urllib.request.Request(f"https://{HOST}/?{qs}", data=payload, method="POST", headers={
        "Host": HOST, "Content-Type": ct, "X-Date": amz_date,
        "X-Content-Sha256": payload_hash, "Authorization": auth,
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return json.loads(body) if body.startswith("{") else {"HTTPError": e.code, "Body": body}


def pp(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))


def main():
    if not AK or not SK:
        sys.exit("Error: set VOLC_ACCESSKEY and VOLC_SECRETKEY env vars")

    # 1. Zones
    print("=== 1. Zones ===")
    r = volc_api("ecs", "DescribeZones", "2020-04-01")
    zones = r.get("Result", {}).get("Zones", [])
    for z in zones:
        print(f"  {z['ZoneId']}")
    zone = "cn-beijing-a"

    # 2. VPC
    print("\n=== 2. VPC ===")
    r = volc_api("vpc", "DescribeVpcs", "2020-04-01")
    vpcs = r.get("Result", {}).get("Vpcs", [])
    if vpcs:
        vpc_id = vpcs[0]["VpcId"]
        print(f"  Found: {vpc_id}")
    else:
        print("  No VPC, creating...")
        r = volc_api("vpc", "CreateVpc", "2020-04-01", {
            "VpcName": "neo-vpc", "CidrBlock": "172.16.0.0/16",
        })
        vpc_id = r.get("Result", {}).get("VpcId", "")
        if not vpc_id:
            print("  Failed:"); pp(r); return
        print(f"  Created: {vpc_id}")

    # 3. Subnet
    print("\n=== 3. Subnet ===")
    r = volc_api("vpc", "DescribeSubnets", "2020-04-01", {"VpcId": vpc_id})
    subnets = r.get("Result", {}).get("Subnets", [])
    if subnets:
        subnet_id = subnets[0]["SubnetId"]
        print(f"  Found: {subnet_id}")
    else:
        print("  No Subnet, creating...")
        r = volc_api("vpc", "CreateSubnet", "2020-04-01", {
            "VpcId": vpc_id, "SubnetName": "neo-subnet",
            "CidrBlock": "172.16.0.0/24", "ZoneId": zone,
        })
        subnet_id = r.get("Result", {}).get("SubnetId", "")
        if not subnet_id:
            print("  Failed:"); pp(r); return
        print(f"  Created: {subnet_id}")

    # 4. Security Group
    print("\n=== 4. Security Group ===")
    r = volc_api("vpc", "DescribeSecurityGroups", "2020-04-01", {"VpcId": vpc_id})
    sgs = r.get("Result", {}).get("SecurityGroups", [])
    if sgs:
        sg_id = sgs[0]["SecurityGroupId"]
        print(f"  Found: {sg_id}")
    else:
        print("  No SG, creating...")
        r = volc_api("vpc", "CreateSecurityGroup", "2020-04-01", {
            "VpcId": vpc_id, "SecurityGroupName": "neo-sg",
        })
        sg_id = r.get("Result", {}).get("SecurityGroupId", "")
        if not sg_id:
            print("  Failed:"); pp(r); return
        print(f"  Created: {sg_id}")
        # Open ports: 22, 80, 443, 8000
        for port in [22, 80, 443, 8000]:
            volc_api("vpc", "AuthorizeSecurityGroupIngress", "2020-04-01", {
                "SecurityGroupId": sg_id,
                "Protocol": "tcp",
                "PortStart": str(port),
                "PortEnd": str(port),
                "CidrIp": "0.0.0.0/0",
            })
            print(f"    Opened port {port}")

    print(f"\n=== Summary ===")
    print(f"  Zone:     {zone}")
    print(f"  VPC:      {vpc_id}")
    print(f"  Subnet:   {subnet_id}")
    print(f"  SG:       {sg_id}")

    if "--create" not in sys.argv:
        print(f"\n  Run with --create to create ECS instance")
        print(f"  Spec: ecs.g3i.large (2C 8G), Ubuntu 22.04, 40GB ESSD")
        return

    # 5. Create ECS
    print("\n=== 5. Create ECS ===")
    r = volc_api("ecs", "RunInstances", "2020-04-01", {
        "ZoneId": zone,
        "InstanceTypeId": "ecs.g3i.large",
        "ImageId": "image-ycby1gkhke5g5j1k221q",
        "InstanceName": "neo-prod",
        "Description": "Neo personal website",
        "InstanceChargeType": "PostPaid",
        "SubnetId": subnet_id,
        "SecurityGroupIds.1": sg_id,
        "Volumes.1.VolumeType": "ESSD_PL0",
        "Volumes.1.Size": "40",
        "Volumes.1.DeleteWithInstance": "true",
        "NetworkInterfaces.1.SubnetId": subnet_id,
        "NetworkInterfaces.1.SecurityGroupIds.1": sg_id,
        "Password": "Neo@2024Prod!",
    })
    pp(r)
    instance_ids = r.get("Result", {}).get("InstanceIds", [])
    if instance_ids:
        print(f"\n  Instance created: {instance_ids[0]}")
        print(f"  Password: Neo@2024Prod!")
        print(f"  Wait a few minutes, then allocate EIP and SSH in.")


if __name__ == "__main__":
    main()
