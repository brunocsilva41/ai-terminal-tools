import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const PROFILES_PATH = path.resolve(__dirname, "profiles.json");

function parseArgs(argv) {
  const args = {
    activation: "",
    prompt: "",
    list: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      args.list = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--activation") {
      args.activation = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--prompt") {
      args.prompt = argv[i + 1] || "";
      i += 1;
      continue;
    }
  }

  return args;
}

function loadProfiles() {
  const raw = fs.readFileSync(PROFILES_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.profiles)) {
    throw new Error("Invalid activation profiles file.");
  }
  return parsed.profiles;
}

function resolveProfile(profiles, activation) {
  const normalized = activation.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return (
    profiles.find((profile) => {
      if ((profile.id || "").toLowerCase() === normalized) {
        return true;
      }
      const aliases = Array.isArray(profile.aliases) ? profile.aliases : [];
      return aliases.some((alias) => String(alias).toLowerCase() === normalized);
    }) || null
  );
}

function composePrompt(profile, prompt) {
  if (!profile) {
    return prompt;
  }

  const promptFile = path.resolve(REPO_ROOT, profile.promptFile);
  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }
  const systemPrompt = fs.readFileSync(promptFile, "utf8").trim();
  const userPrompt = (prompt || "").trim();
  if (!userPrompt) {
    throw new Error("Missing user prompt.");
  }

  return `[ACTIVATION PROFILE: ${profile.id}]
${systemPrompt}

[USER REQUEST]
${userPrompt}`;
}

function printList(profiles, asJson) {
  const list = profiles.map((profile) => ({
    id: profile.id,
    aliases: profile.aliases || [],
    description: profile.description || "",
    promptFile: profile.promptFile
  }));
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ profiles: list }, null, 2)}\n`);
    return;
  }

  const lines = ["Activation profiles:"];
  for (const profile of list) {
    lines.push(`- ${profile.id} :: ${(profile.aliases || []).join(", ")}`);
    lines.push(`  ${profile.description}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const profiles = loadProfiles();

  if (args.list) {
    printList(profiles, args.json);
    return;
  }

  if (!args.prompt.trim()) {
    throw new Error("Missing --prompt.");
  }

  const profile = resolveProfile(profiles, args.activation);
  if (args.activation && !profile) {
    throw new Error(`Unknown activation profile: ${args.activation}`);
  }

  const composed = composePrompt(profile, args.prompt);
  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          activation: profile ? profile.id : null,
          prompt: composed
        },
        null,
        2
      )}\n`
    );
    return;
  }
  process.stdout.write(composed);
}

try {
  main();
} catch (error) {
  console.error(`compose_prompt error: ${error.message}`);
  process.exit(1);
}
