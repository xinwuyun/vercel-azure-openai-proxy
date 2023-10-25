// The name of your Azure OpenAI Resource.
const resourceName=process.env.RESOURCE_NAME

// The deployment name you chose when you deployed the model.
const mapper = {
    'gpt-3.5-turbo': process.env.DEPLOY_NAME_GPT35,
    'gpt-3.5-turbo-16k': process.env.DEPLOY_NAME_GPT35_16K,
    // 'gpt-4': process.env.DEPLOY_NAME_GPT4,
    // 'gpt-4-32k': process.env.DEPLOY_NAME_GPT4_32K,
};

const apiVersion="2023-08-01-preview"

// addEventListener("fetch", (event) => {
//   event.respondWith(handleRequest(event.request));
// });

export async function handleRequest(request, res, path) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request)
  }
    
  const url = new URL(path, 'http://localhost'); // Use a dummy base URL
  if (url.pathname.startsWith("//")) {
    url.pathname = url.pathname.replace('/',"")
  }
  if (url.pathname === '/v1/chat/completions') {
    var path="chat/completions"
  } else if (url.pathname === '/v1/completions') {
    var path="completions"
  } else if (url.pathname === '/v1/models') {
    return handleModels(request)
  } else {
    return new Response('404 Not Found', { status: 404 })
  }

  let body;
  if (request.method === 'POST') {
    body = await request.json();
  }

  const modelName = body?.model;  
  const deployName = mapper[modelName] || '' 

  if (deployName === '') {
    return new Response('Missing model mapper', {
        status: 403
    });
  }
  const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`

  const authKey = request.headers.get('Authorization');
  if (!authKey) {
    return new Response("Not allowed", {
      status: 403
    });
  }

  const payload = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "api-key": authKey.replace('Bearer ', ''),
    },
    body: typeof body === 'object' ? JSON.stringify(body) : '{}',
  };

  let response = await fetch(fetchAPI, payload);
  response = new Response(response.body, response);
  response.headers.set("Access-Control-Allow-Origin", "*");

  if (body?.stream != true){
    return response
  } 

  let { readable, writable } = new TransformStream()
  stream(response.body, writable);
  return new Response(readable, response);

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// support printer mode and add newline
// The name of your Azure OpenAI Resource for GPT-3.5 and GPT-4.
const resourceName = "fubaov1";

// The deployment name you chose when you deployed the model for GPT-3.5 and GPT-4.
const deployNameGPT35 = process.env.DEPLOY_NAME_GPT35;
const deployNameGPT35_16K = process.env.DEPLOY_NAME_GPT35_16K;
const deployNameGPT4 = process.env.DEPLOY_NAME_GPT4;
const mapper = {
    'gpt-3.5-turbo': "gpt3",
    'gpt-3.5-turbo-16k': "gpt-35-turbo-16k",
    // 'gpt-4': DEPLOY_NAME_GPT4,
    // 'gpt-4-32k': DEPLOY_NAME_GPT4_32K,
};
const apiVersion="2023-08-01-preview"

async function handleRequest(request, res, path) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request, res)
  }

  // const url = new URL(request.url);
  const url = new URL(path, 'http://localhost'); // Use a dummy base URL
  if (url.pathname === '/v1/chat/completions') {
    var path="chat/completions"
  } else if (url.pathname === '/v1/completions') {
    var path="completions"
  } else if (url.pathname === '/v1/models') {
    return handleModels(request, res)
  } else {
    res.status(404).send('404 Not Found');
    return;
  }
  
  let body;
  if (request.method === 'POST') {
    body = request.body;
  }
  const modelName = body && body.model ? body.model : "gpt-3.5-turbo";
  const { resourceName, deployName } = getModelMapper(modelName);

  const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`
  
  const authKey = request.get('Authorization');
  if (!authKey) {
    res.status(403).send('Not allowed');
    return;
  }

  const payload = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "api-key": authKey.replace('Bearer ', ''),
    },
    body: typeof body === 'object' ? JSON.stringify(body) : '{}',
  };

  // let { readable, writable } = new TransformStream()
  const response = await fetch(fetchAPI, payload);
  if (response.status !== 200) {
    res.status(response.status).send(response.statusText);
    return;
  }
  res.setHeader('Content-Type', response.headers.get('Content-Type'));
  await stream(response.body, res);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getModelMapper(model) {
  const deployName = mapper[model] || '';
  if (deployName === '') {
    throw new Error("Invalid model specified");
  }
  return { resourceName: resourceName, deployName:  deployName};
}

async function stream(readable, res) {
  const reader = readable.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const delimiter = "\n\n";
  const encodedNewline = encoder.encode("\n");

  let buffer = "";
  while (true) {
    let { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }); // stream: true is important here,fix the bug of incomplete line
    let lines = buffer.split(delimiter);

    // Loop through all but the last line, which may be incomplete.
    for (let i = 0; i < lines.length - 1; i++) {
      res.write(lines[i] + delimiter);
      await sleep(30);
    }
    buffer = lines[lines.length - 1];
  }

  if (buffer) {
    res.write(buffer);
  }
  res.write(encodedNewline);
  res.end();
}

async function handleModels(request, res) {
  const data = {
    "object": "list",
    "data": []  
  };

  for (let key in mapper) {
    data.data.push({
      "id": key,
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai",
      "permission": [{
        "id": "modelperm-M56FXnG1AsIr3SXq8BYPvXJA",
        "object": "model_permission",
        "created": 1679602088,
        "allow_create_engine": false,
        "allow_sampling": true,
        "allow_logprobs": true,
        "allow_search_indices": false,
        "allow_view": true,
        "allow_fine_tuning": false,
        "organization": "*",
        "group": null,
        "is_blocking": false
      }],
      "root": key,
      "parent": null
    });  
  }

  res.status(200).json(data);
}

async function handleOPTIONS(request, res) {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*'
    }).status(200).send();
}
