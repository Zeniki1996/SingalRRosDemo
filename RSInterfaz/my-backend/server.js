const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

// Configura el middleware
app.use(cors());
app.use(bodyParser.json());

// Ruta para manejar la solicitud a Azure OpenAI
app.post('/api/openai', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post(
      'https://nonprodchatrobotopenai.openai.azure.com/openai/deployments/implmentacionchatservicioUDLA/chat/completions?api-version=2024-02-01',
      {
        data_sources: [
          {
            type: "azure_search",
            parameters: {
              endpoint: "https://nonprodchatrobotaisearch.search.windows.net",
              index_name: "contenedorudlaservicebot",
              semantic_configuration: "default",
              query_type: "simple",
              fields_mapping: {},
              in_scope: true,
              role_information: "Te llamas ULI, eres un asistente virtual para la Universidad de las Americas (UDLA). Si te saludan debes responder con otro saludo, dando la bienvenida y explicando tu nombre y función. Es muy importante que si te realizan preguntas no relacionadas a la universidad simplemente respondas: 'Lo siento, no estoy seguro'. Responderás siempre de forma amigable y tratando de ayudar. Tratarás de responder en español a menos que las preguntas sean en otros idiomas.",
              filter: null,
              strictness: 3,
              top_n_documents: 5,
              authentication: {
                type: "api_key",
                key: ""
              },
              key: ""

            }
          }
        ],
        messages: [
          {
            role: "system",
            content: "Te llamas ULI, eres un asistente virtual para la Universidad de las Americas (UDLA). Si te saludan debes responder con otro saludo, dando la bienvenida y explicando tu nombre y función. Es muy importante que si te realizan preguntas no relacionadas a la universidad simplemente respondas: 'Lo siento, no estoy seguro'. Responderás siempre de forma amigable y tratando de ayudar. Tratarás de responder en español a menos que las preguntas sean en otros idiomas."

          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0,
        top_p: 1,
        max_tokens: 800
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': '1d896159bce74b84a433836f6d660d8c'
        }
      }
    );

    res.json({ text: response.data.choices[0].message.content });
  } catch (error) {
    console.error('Error al llamar a Azure OpenAI:', error);
    res.status(500).send('Error al llamar a Azure OpenAI');
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
