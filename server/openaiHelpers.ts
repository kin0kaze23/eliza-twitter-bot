export function buildOpenAIParams(modelName: string, baseParams: any) {
  const params = { ...baseParams };
  const modelLower = (modelName || "").toLowerCase();
  
  const temperatureOnlyModels = [
    "mini", "4o-mini", "gpt-5", "gpt-4.1", "o1", "reasoning",
    "thinking", "preview", "experimental", "latest"
  ];
  
  const isRestrictedModel = temperatureOnlyModels.some(m => modelLower.includes(m));
  
  if (isRestrictedModel) {
    params.temperature = 1;
    delete params.frequency_penalty;
    delete params.presence_penalty;
  }
  
  return params;
}

export async function safeOpenAICall(openai: any, params: any, retryCount = 0): Promise<any> {
  try {
    return await openai.chat.completions.create(params);
  } catch (error: any) {
    if (retryCount === 0 && error.error?.code === "unsupported_parameter") {
      const paramName = error.error?.param;
      if (paramName) {
        console.log(`Parameter "${paramName}" not supported for this model, retrying without it...`);
        const retryParams = { ...params };
        delete retryParams[paramName];
        return safeOpenAICall(openai, retryParams, retryCount + 1);
      }
    }
    throw error;
  }
}
