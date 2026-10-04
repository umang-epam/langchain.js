import { loadEnvConfig } from "@next/env";
import { AzureChatOpenAI } from "@langchain/openai";

loadEnvConfig(process.cwd());

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is missing. Put it in .env.local (not .env.example) and restart npm run dev.`,
    );
  }
  return value;
}

export function createDialChatModel() {
  const endpoint = requiredEnv("DIAL_URL").replace(/\/$/, "");
  const apiKey = requiredEnv("DIAL_API_KEY");
  const deployment = requiredEnv("DIAL_DEPLOYMENT");
  const apiVersion = process.env.DIAL_API_VERSION?.trim() || "2024-02-01";

  return new AzureChatOpenAI({
    apiKey,
    azureOpenAIApiKey: apiKey,
    azureOpenAIEndpoint: endpoint,
    azureOpenAIApiDeploymentName: deployment,
    azureOpenAIApiVersion: apiVersion,
    temperature: 0.2,
    configuration: {
      apiKey,
      defaultHeaders: {
        "Api-Key": apiKey,
        "api-key": apiKey,
      },
    },
  });
}
