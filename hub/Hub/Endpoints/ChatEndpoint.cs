using Hub.Contracts.Chat;
using Hub.Secrets;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Hub.Endpoints
{
    public static class ChatEndpoint
    {
        private const string RoleInfo =
            """
            Te llamas ULI, eres un asistente virtual para la Universidad de las Americas (UDLA). 
            Si te saludan debes responder con otro saludo, dando la bienvenida y explicando tu nombre y función.
            Es muy importante que si te realizan preguntas no relacionadas a la universidad simplemente respondas: 'Lo siento, no estoy seguro'.
            Responderás siempre de forma amigable y tratando de ayudar. 
            Tratarás de responder en español a menos que las preguntas sean en otros idiomas.
            """;

        public static WebApplication MapChatEndpoint(this WebApplication app)
        {
            app.MapPost("/chat/answer", async (ChatAnswerRequest request,
                IHttpClientFactory httpClientFactory,
                IOptionsMonitor<UrlSettings> urlSettings,
                IOptionsMonitor<SecretSettings> secretSettings) =>
            {
                if (string.IsNullOrWhiteSpace(request.Prompt))
                {
                    return Results.BadRequest("Prompt is required");
                }

                var client = httpClientFactory.CreateClient();
                client.BaseAddress = new Uri(urlSettings.CurrentValue.AzureOpenAI);
                client.DefaultRequestHeaders.Add("api-key", secretSettings.CurrentValue.AzureOpenAIKey);

                //Objeto de azureopenai
                var data = new
                {
                    data_sources = new[]
                    {
                        new
                        {
                            type = "azure_search",
                            parameters = new
                            {
                                endpoint = urlSettings.CurrentValue.AzureSearch,
                                index_name = "contenedorudlaservicebot",
                                semantic_configuration = "default",
                                query_type = "simple",
                                fields_mapping = new { },
                                in_scope = true,
                                role_information = RoleInfo,
                                filter = (string?)null,
                                strictness = 3,
                                top_n_documents = 5,
                                authentication = new
                                {
                                    type = "api_key",
                                    key = secretSettings.CurrentValue.AzureAISearchKey,
                                },
                                key = secretSettings.CurrentValue.AzureAISearchKey
                            }
                        }
                    },
                    messages = new[]
                    {
                        new
                        {
                            role = "system",
                            content = RoleInfo
                        },
                        new
                        {
                            role = "user",
                            content = request.Prompt
                        }
                    },
                    temperature = 0,
                    top_p = 1,
                    max_tokens = 800
                };

                using var response = await client.PostAsJsonAsync("chat/completions?api-version=2024-02-01", data);
                var resultStr = await response.Content.ReadAsStringAsync();
                dynamic? result = JsonConvert.DeserializeObject(resultStr);
                response.EnsureSuccessStatusCode();
                if (result is null)
                {
                    throw new Exception("No answer");
                }

                string text = result.choices[0].message.content.ToString();

                return Results.Ok(new ChatAnswerResponse(text));
            }).WithTags("Chat");
            return app;
        }
    }
}
