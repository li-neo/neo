"""Seed database with sample data for development."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import get_engine, get_session_factory, Base
import app.models  # noqa
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.post import Post
from app.models.skill import Skill
from app.models.guestbook import GuestbookEntry
from app.models.integration import Integration


def seed():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    Session = get_session_factory()
    db = Session()

    try:
        # --- Admin user ---
        if not db.query(User).first():
            admin = User(
                github_id=1,
                username="neo-admin",
                display_name="Neo",
                avatar_url="https://avatars.githubusercontent.com/u/1?v=4",
                email="admin@neo.dev",
                bio="Builder of AI systems",
                role=UserRole.admin,
            )
            db.add(admin)
            db.flush()
            admin_id = admin.id
            print(f"  Created admin user (id={admin_id})")
        else:
            admin_id = db.query(User).first().id
            print(f"  Admin user already exists (id={admin_id})")

        # --- Projects ---
        if db.query(Project).count() == 0:
            projects = [
                Project(
                    slug="llm-reasoning-engine",
                    title="LLM Reasoning Engine",
                    description="A high-performance reasoning framework for large language models with chain-of-thought, tree-of-thought, and self-reflection capabilities. Supports GPT-4, Claude, Llama 3, and custom models.",
                    category="llm",
                    tech_stack=["Python", "PyTorch", "vLLM", "LangChain", "FastAPI"],
                    cover_url="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
                    repo_url="https://github.com/example/llm-reasoning",
                    featured=True,
                    sort_order=1,
                    status="published",
                ),
                Project(
                    slug="vla-autonomous-driving",
                    title="VLA Autonomous Driving System",
                    description="Vision-Language-Action model for end-to-end autonomous driving. Combines visual perception, language understanding, and action planning in a unified transformer architecture.",
                    category="vla",
                    tech_stack=["Python", "PyTorch", "CUDA", "ROS2", "OpenCV", "Transformers"],
                    cover_url="https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800",
                    demo_url="https://huggingface.co/spaces/example/vla-demo",
                    repo_url="https://github.com/example/vla-driving",
                    hf_url="https://huggingface.co/example/vla-model",
                    featured=True,
                    sort_order=2,
                    status="published",
                ),
                Project(
                    slug="multimodal-fusion-net",
                    title="Multimodal Fusion Network",
                    description="Cross-modal fusion architecture that aligns vision, language, and audio embeddings. Achieves SOTA on VQA, image captioning, and audio-visual tasks.",
                    category="multimodal",
                    tech_stack=["Python", "PyTorch", "Transformers", "CLIP", "Whisper"],
                    cover_url="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800",
                    repo_url="https://github.com/example/multimodal-fusion",
                    hf_url="https://huggingface.co/example/fusion-net",
                    featured=True,
                    sort_order=3,
                    status="published",
                ),
                Project(
                    slug="world-model-simulator",
                    title="World Model Simulator",
                    description="Neural world model that learns physics and dynamics from video data. Enables imagination-based planning for robotics and game AI agents.",
                    category="world_model",
                    tech_stack=["Python", "PyTorch", "JAX", "MuJoCo", "Diffusion Models"],
                    cover_url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800",
                    repo_url="https://github.com/example/world-model",
                    featured=True,
                    sort_order=4,
                    status="published",
                ),
                Project(
                    slug="distributed-training-framework",
                    title="Distributed Training Framework",
                    description="Scalable distributed training framework supporting data parallelism, tensor parallelism, and pipeline parallelism. Optimized for training 100B+ parameter models across GPU clusters.",
                    category="llm",
                    tech_stack=["Python", "PyTorch", "DeepSpeed", "NCCL", "Kubernetes"],
                    cover_url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800",
                    repo_url="https://github.com/example/dist-train",
                    sort_order=5,
                    status="published",
                ),
                Project(
                    slug="embodied-agent-platform",
                    title="Embodied Agent Platform",
                    description="Platform for training and deploying embodied AI agents that can perceive, reason, and act in both simulated and real-world environments.",
                    category="vla",
                    tech_stack=["Python", "PyTorch", "Isaac Sim", "ROS2", "gRPC"],
                    cover_url="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
                    repo_url="https://github.com/example/embodied-agent",
                    sort_order=6,
                    status="published",
                ),
            ]
            db.add_all(projects)
            print(f"  Created {len(projects)} projects")

        # --- Blog posts ---
        if db.query(Post).count() == 0:
            posts = [
                Post(
                    slug="scaling-llm-inference",
                    title="Scaling LLM Inference: From Single GPU to Production",
                    summary="A deep dive into techniques for scaling LLM inference — from KV-cache optimization and continuous batching to speculative decoding and multi-GPU serving.",
                    content="# Scaling LLM Inference\n\nAs LLMs grow larger, efficient inference becomes critical...\n\n## Key Techniques\n\n### 1. KV-Cache Optimization\nPagedAttention reduces memory waste by up to 90%.\n\n### 2. Continuous Batching\nDynamic batching of requests maximizes GPU utilization.\n\n### 3. Speculative Decoding\nUsing a smaller draft model to predict multiple tokens at once.\n\n## Benchmarks\n\nOur framework achieves 3x throughput improvement over vanilla serving.",
                    tags=["LLM", "Inference", "Performance", "GPU"],
                    cover_url="https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800",
                    published=True,
                    reading_time=8,
                ),
                Post(
                    slug="vision-language-action-models",
                    title="Vision-Language-Action: The Future of Autonomous Driving",
                    summary="How VLA models are revolutionizing autonomous driving by unifying perception, language understanding, and action planning in a single model.",
                    content="# VLA Models for Autonomous Driving\n\nTraditional autonomous driving stacks are modular...\n\n## The VLA Paradigm\n\nVLA models process visual inputs, understand natural language instructions, and output driving actions — all end-to-end.\n\n## Architecture\n\n- Vision encoder: ViT-L\n- Language backbone: LLaMA 3\n- Action head: Diffusion policy\n\n## Results\n\nOur VLA model achieves a 40% reduction in collision rate compared to modular baselines.",
                    tags=["VLA", "Autonomous Driving", "Multimodal", "Robotics"],
                    cover_url="https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800",
                    published=True,
                    reading_time=12,
                ),
                Post(
                    slug="building-world-models",
                    title="Building World Models: Learning Physics from Video",
                    summary="An exploration of how neural world models can learn physical dynamics from unlabeled video data and enable planning through imagination.",
                    content="# World Models\n\nWorld models learn to predict the future state of an environment...\n\n## Approach\n\n1. Train a video prediction model on large-scale video data\n2. Learn a latent dynamics model\n3. Use imagination for planning\n\n## Key Insights\n\n- Diffusion-based world models produce higher fidelity predictions\n- Latent space planning is 100x more efficient than pixel-space\n- Self-supervised pretraining is crucial for generalization",
                    tags=["World Models", "Video Prediction", "Planning", "Diffusion"],
                    cover_url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800",
                    published=True,
                    reading_time=10,
                ),
            ]
            db.add_all(posts)
            print(f"  Created {len(posts)} posts")

        # --- Skills ---
        if db.query(Skill).count() == 0:
            skills = [
                Skill(
                    slug="code-reviewer",
                    name="Code Reviewer",
                    description="Automated code review skill that analyzes PRs for bugs, security issues, and style violations using LLM-powered analysis.",
                    category="development",
                    version="1.2.0",
                    author_id=admin_id,
                    source_url="https://github.com/example/skill-code-reviewer",
                    install_command="codex install code-reviewer",
                    install_count=1250,
                    status="published",
                    platform="openclaw",
                ),
                Skill(
                    slug="doc-generator",
                    name="Doc Generator",
                    description="Automatically generates comprehensive documentation from code, including API references, usage examples, and architecture diagrams.",
                    category="documentation",
                    version="2.0.1",
                    author_id=admin_id,
                    source_url="https://github.com/example/skill-doc-gen",
                    install_command="codex install doc-generator",
                    install_count=890,
                    status="published",
                    platform="openclaw",
                ),
                Skill(
                    slug="deploy-assistant",
                    name="Deploy Assistant",
                    description="Streamlines deployment workflows — generates Dockerfiles, CI/CD configs, and monitors deployment health.",
                    category="devops",
                    version="1.5.0",
                    author_id=admin_id,
                    source_url="https://github.com/example/skill-deploy",
                    install_command="codex install deploy-assistant",
                    install_count=670,
                    status="published",
                    platform="openclaw",
                ),
                Skill(
                    slug="model-trainer",
                    name="Model Trainer",
                    description="End-to-end ML model training skill. Supports hyperparameter tuning, distributed training, and experiment tracking.",
                    category="ml",
                    version="0.8.0",
                    author_id=admin_id,
                    source_url="https://github.com/example/skill-model-trainer",
                    install_command="codex install model-trainer",
                    install_count=430,
                    status="published",
                    platform="openclaw",
                ),
                Skill(
                    slug="data-pipeline",
                    name="Data Pipeline Builder",
                    description="Creates and manages ETL pipelines for ML data preprocessing. Supports streaming and batch processing.",
                    category="data",
                    version="1.0.0",
                    author_id=admin_id,
                    source_url="https://github.com/example/skill-data-pipeline",
                    install_command="codex install data-pipeline",
                    install_count=310,
                    status="published",
                    platform="openclaw",
                ),
            ]
            db.add_all(skills)
            print(f"  Created {len(skills)} skills")

        # --- Guestbook ---
        if db.query(GuestbookEntry).count() == 0:
            entries = [
                GuestbookEntry(user_id=admin_id, message="Welcome to Neo! This is the first guestbook entry. Feel free to leave your thoughts here."),
            ]
            db.add_all(entries)
            print(f"  Created {len(entries)} guestbook entries")

        # --- Integrations ---
        if db.query(Integration).count() == 0:
            integrations = [
                Integration(name="github", display_name="GitHub", type="oauth", enabled=True, status="connected"),
                Integration(name="huggingface", display_name="Hugging Face", type="api_key"),
                Integration(name="openclaw", display_name="OpenClaw", type="api_key"),
                Integration(name="mcp", display_name="MCP Service", type="mcp", enabled=True, status="connected"),
            ]
            db.add_all(integrations)
            print(f"  Created {len(integrations)} integrations")

        db.commit()
        print("\nSeed complete!")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding database...")
    seed()
