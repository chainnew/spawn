Structured Outputs

Copy page

Return structured data from your models
OpenRouter supports structured outputs for compatible models, ensuring responses follow a specific JSON Schema format. This feature is particularly useful when you need consistent, well-formatted responses that can be reliably parsed by your application.

Overview
Structured outputs allow you to:

Enforce specific JSON Schema validation on model responses
Get consistent, type-safe outputs
Avoid parsing errors and hallucinated fields
Simplify response handling in your application
Using Structured Outputs
To use structured outputs, include a response_format parameter in your request, with type set to json_schema and the json_schema object containing your schema:

{
  "messages": [
    { "role": "user", "content": "What's the weather like in London?" }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "weather",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "City or location name"
          },
          "temperature": {
            "type": "number",
            "description": "Temperature in Celsius"
          },
          "conditions": {
            "type": "string",
            "description": "Weather conditions description"
          }
        },
        "required": ["location", "temperature", "conditions"],
        "additionalProperties": false
      }
    }
  }
}


The model will respond with a JSON object that strictly follows your schema:

{
  "location": "London",
  "temperature": 18,
  "conditions": "Partly cloudy with light drizzle"
}


Model Support
Structured outputs are supported by select models.

You can find a list of models that support structured outputs on the models page.

OpenAI models (GPT-4o and later versions) Docs
Google Gemini models Docs
Anthropic models (Sonnet 4.5 and Opus 4.1) Docs
Most open-source models
All Fireworks provided models Docs
To ensure your chosen model supports structured outputs:

Check the model’s supported parameters on the models page
Set require_parameters: true in your provider preferences (see Provider Routing)
Include response_format and set type: json_schema in the required parameters
Best Practices
Include descriptions: Add clear descriptions to your schema properties to guide the model

Use strict mode: Always set strict: true to ensure the model follows your schema exactly

Example Implementation
Here’s a complete example using the Fetch API:


TypeScript SDK

Python

TypeScript (fetch)


import { OpenRouter } from '@openrouter/sdk';
const openRouter = new OpenRouter({
  apiKey: '<OPENROUTER_API_KEY>',
});
const response = await openRouter.chat.send({
  model: 'openai/gpt-4',
  messages: [
    { role: 'user', content: 'What is the weather like in London?' },
  ],
  responseFormat: {
    type: 'json_schema',
    jsonSchema: {
      name: 'weather',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or location name',
          },
          temperature: {
            type: 'number',
            description: 'Temperature in Celsius',
          },
          conditions: {
            type: 'string',
            description: 'Weather conditions description',
          },
        },
        required: ['location', 'temperature', 'conditions'],
        additionalProperties: false,
      },
    },
  },
  stream: false,
});
const weatherInfo = response.choices[0].message.content;
Streaming with Structured Outputs
Structured outputs are also supported with streaming responses. The model will stream valid partial JSON that, when complete, forms a valid response matching your schema.

To enable streaming with structured outputs, simply add stream: true to your request:

{
  "stream": true,
  "response_format": {
    "type": "json_schema",
    // ... rest of your schema
  }
}


