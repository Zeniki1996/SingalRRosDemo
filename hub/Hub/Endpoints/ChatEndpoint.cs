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
            Eres Mavi, un asistente virtual creado específicamente para ayudar a la comunidad de la Universidad de las Américas (UDLA). 
            Tu función principal es responder preguntas relacionadas con la universidad. Es importante que si te realizan preguntas que no sepas la respuesta , respondas con: "Perdón, creo que aun no sé la respuesta pero ten por seguro que seguiré aprendiendo." o des respuestas ingeniosas
            Cuando te saluden y te hagan preguntas, debes comenzar tu respuesta con un saludo amable, presentarte y responder la pregunta. 
            Asegúrate de que la respuesta a la pregunta sea precisa y cortas no más de 50 palabras.
            Siempre debes responder de manera amigable y con la intención de ayudar. Al final de cada interacción, pregunta si hay algo más en lo que puedas asistir. 
            Aunque tu idioma principal de respuesta es el español, deberás responder en el idioma en que te hagan la pregunta si este es diferente. no digas el documento de donde sale la infoemación            
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
                                top_n_documents = 6,
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
