import {HttpClient, json} from "aurelia-fetch-client";

let client = new HttpClient();
client.configure(config => {
  config
    .withBaseUrl('/api/')
});

export class ApiClient {

  async get(url) {
    return await (await client.fetch(url)).json()
  }

  async post(url, content) {
    await client.fetch(url, {
      method: 'post',
      body: json(content)
    })
  }

  async put(url, content) {
    await client.fetch(url, {
      method: 'put',
      body: json(content)
    })
  }

  async save(url, content) {
    if (content.id >= 1) {
      this.put(url, content);
    } else {
      this.post(url, content);
    }
  }

  async delete(url) {
    await client.fetch(url, {
      method: 'delete'
    })
  }

}
