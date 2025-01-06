// library/react-server/src/services/PromptExecutionService.ts
import { LLMSpec, QueryProgress, LLMResponse, Dict } from "../backend/typing";
import { PromptPipeline } from "../backend/query";
import { queryLLM, queryRAG, caching_responses } from "../backend/backend";

export class PromptExecutionService {
  constructor(private nodeId: string) {
    console.log(`Executing prompt node for ID: ${nodeId}`); // Utilizing nodeId for logging
  }

  private extractTemplateVariables(template: string): string[] {
    // Match both {var} and {=var} patterns
    const regex = /\{=?([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1].trim());
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  private processTemplate(template: string, variables: Dict<any>): string {
    let processedTemplate = template;

    // Handle both {var} and {=var} patterns
    Object.entries(variables).forEach(([key, value]) => {
      const patterns = [`{${key}}`, `{=${key}}`];
      patterns.forEach((pattern) => {
        if (processedTemplate.includes(pattern)) {
          let replacementValue = value;
          if (typeof value === "object" && value.output) {
            replacementValue = value.output;
          }
          processedTemplate = processedTemplate.replace(
            pattern,
            String(replacementValue),
          );
        }
      });
    });

    return processedTemplate;
  }

  async executePromptNode(
    promptTemplate: string,
    llmSpecs: LLMSpec[],
    ragSpecs: LLMSpec[],
    variables: Dict<any>,
    apiKeys?: Dict<string>,
    onProgressChange?: (progress: Dict<QueryProgress>) => void,
  ) {
    console.log(`Is API KEY SET: ${process.env.OPENAI_API_KEY}`);
    let processedPrompt = this.processTemplate(promptTemplate, variables);
    console.log("Initial processed prompt:", processedPrompt);

    // Check if all template variables are filled
    const remainingVars = this.extractTemplateVariables(processedPrompt);
    if (remainingVars.length > 0) {
      // For now, use default values for remaining variables
      const defaultValues = remainingVars.reduce((acc, varName) => {
        acc[varName] = `DEFAULT_VALUE_FOR_${varName}`;
        return acc;
      }, {} as Dict<string>);

      // Process again with default values
      processedPrompt = this.processTemplate(processedPrompt, defaultValues);
      console.log("Final prompt with defaults:", processedPrompt);
    }

    const pipeline = new PromptPipeline(processedPrompt);
    let jsonResponses: LLMResponse[] = [];
    let cacheFiles: Dict<string | LLMSpec> = {};

    // console.log("llm specs", llmSpecs);
    console.log("Executing with variables:", variables);

    // console.log("LLM Specifications:", llmSpecs);
    // console.log("RAG Specifications:", ragSpecs);
    console.log("API Keys:", apiKeys);

    // Execute LLM queries
    if (llmSpecs?.length > 0) {
      const llmResult = await queryLLM(
        this.nodeId,
        llmSpecs,
        1, // numGenerations
        processedPrompt,
        // promptTemplate,
        variables,
        undefined, // chat_hist_by_llm
        apiKeys || {},
        false,
        onProgressChange,
      );

      if (llmResult.responses) {
        jsonResponses = llmResult.responses;
      }
      if (llmResult.cache) {
        cacheFiles = llmResult.cache;
      }
    }

    // Execute RAG queries
    if (ragSpecs?.length > 0) {
      const ragResult = await queryRAG(
        this.nodeId,
        ragSpecs,
        processedPrompt,
        // promptTemplate,
        variables,
        [],
        false,
        onProgressChange,
      );

      if (ragResult.responses) {
        jsonResponses = jsonResponses.concat(ragResult.responses);
      }
      if (ragResult.cache) {
        cacheFiles = { ...cacheFiles, ...ragResult.cache };
      }
    }

    // Cache responses
    await caching_responses(jsonResponses, cacheFiles, this.nodeId);

    return {
      responses: jsonResponses,
      cache: cacheFiles,
    };
  }
}
