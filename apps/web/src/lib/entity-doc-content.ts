import type { Project, Skill } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

function section(title: string, body: string) {
  return `## ${title}\n\n${body.trim()}`;
}

export function buildProjectDoc(project: Project, locale: Locale): string {
  const zh = locale === "zh";
  const parts: string[] = [];

  parts.push(
    section(
      zh ? "项目概述" : "Overview",
      project.description?.trim() || (zh ? "该项目暂未补充详细说明。" : "This project does not include a long-form description yet.")
    )
  );

  if (project.tech_stack?.length) {
    parts.push(
      section(
        zh ? "技术栈" : "Tech Stack",
        project.tech_stack.map((item) => `- \`${item}\``).join("\n")
      )
    );
  }

  const linkRows = [
    project.repo_url ? `| ${zh ? "代码仓库" : "Repository"} | [Link](${project.repo_url}) |` : "",
    project.demo_url ? `| ${zh ? "在线演示" : "Demo"} | [Link](${project.demo_url}) |` : "",
    project.hf_url ? `| Hugging Face | [Link](${project.hf_url}) |` : "",
  ].filter(Boolean);
  if (linkRows.length) {
    parts.push(
      section(
        zh ? "资源链接" : "Resources",
        `| ${zh ? "类型" : "Type"} | ${zh ? "地址" : "URL"} |\n| --- | --- |\n${linkRows.join("\n")}`
      )
    );
  }

  parts.push(
    section(
      zh ? "方案说明" : "Approach",
      `${zh ? "<icon name=\"rocket\"></icon> 这个项目会以“文档优先”的方式展示关键上下文。" : "<icon name=\"rocket\"></icon> This project is presented as a document-first artifact."}\n\n${
        zh
          ? "这个页面将项目的核心摘要、技术栈与外部资源整理成文档结构，便于快速理解项目价值、实现方向与交付形态。后续如果补充更详细的项目正文，可以直接扩展为完整技术方案页。"
          : "This page organizes the project into a document-style structure so readers can understand its value, implementation direction, and delivery surface quickly. It can later grow into a full technical write-up."
      }`
    )
  );

  parts.push(
    section(
      zh ? "实现要点" : "Implementation Notes",
      `> [!TIP]\n> ${zh ? "如果项目后续补充了更完整的长文正文、架构图或截图，这个详情页会自动支持表格、图像、图标提示块和更复杂的富文本内容。" : "If the project later adds a full write-up, diagrams, or screenshots, this page already supports tables, images, icon callouts, and richer content."}`
    )
  );

  return parts.join("\n\n");
}

export function buildSkillDoc(skill: Skill, locale: Locale): string {
  const zh = locale === "zh";
  const parts: string[] = [];

  parts.push(
    section(
      zh ? "能力概述" : "Overview",
      skill.description?.trim() || (zh ? "该 Skill 暂未补充详细说明。" : "This skill does not include a long-form description yet.")
    )
  );

  parts.push(
    section(
      zh ? "适用场景" : "Use Cases",
      zh
        ? `- 适用于 ${skill.category} 类任务\n- 运行平台：\`${skill.platform}\`\n- 当前版本：\`v${skill.version}\``
        : `- Designed for ${skill.category} workflows\n- Runtime platform: \`${skill.platform}\`\n- Current version: \`v${skill.version}\``
    )
  );

  if (skill.install_command) {
    parts.push(
      section(
        zh ? "安装方式" : "Installation",
        `\`\`\`bash\n${skill.install_command}\n\`\`\``
      )
    );
  }

  const links = [skill.source_url ? `- ${zh ? "源码地址" : "Source"}: [${skill.source_url}](${skill.source_url})` : ""].filter(Boolean);
  if (links.length) {
    parts.push(section(zh ? "相关链接" : "Links", links.join("\n")));
  }

  parts.push(
    section(
      zh ? "能力摘要" : "Capability Matrix",
      `| ${zh ? "字段" : "Field"} | ${zh ? "值" : "Value"} |\n| --- | --- |\n| ${zh ? "分类" : "Category"} | ${skill.category} |\n| ${zh ? "平台" : "Platform"} | ${skill.platform} |\n| ${zh ? "版本" : "Version"} | v${skill.version} |`
    )
  );

  parts.push(
    section(
      zh ? "执行模式" : "Execution Model",
      `${zh ? "<icon name=\"sparkles\"></icon> Skill 不应只是一个名字或标签，而应是一份可读的执行方案。" : "<icon name=\"sparkles\"></icon> A skill should be presented as an executable design document, not just a label."}\n\n${
        zh
          ? "Skill 的职责是把自然语言需求收敛成结构化执行动作，并通过统一 CLI 或平台能力完成真正的自动化执行。因此，Skill 页面也应像技术方案文档一样，清楚说明适用场景、安装方式、平台与执行边界。"
          : "A skill should translate natural-language intent into structured execution through a stable control plane such as a CLI. This page therefore presents the skill as an implementation document rather than just a card."
      }`
    )
  );

  parts.push(
    section(
      zh ? "提示" : "Notes",
      `> [!NOTE]\n> ${zh ? "如果后续给 Skill 增加更完整的设计稿、运行截图或流程图，这个详情页会自动支持更丰富的富文本内容展示。" : "If the skill later includes richer design notes, screenshots, or flow diagrams, this page is already ready for them."}`
    )
  );

  return parts.join("\n\n");
}
