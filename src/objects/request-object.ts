import { v4 } from "uuid";

import { RpcBaseObject } from "./base-object";

type RequestObjectParams = Record<string, any> | any[];

export class RequestObject extends RpcBaseObject {
  private id: string;
  private method: string;
  private params: RequestObjectParams;

  constructor(method: string, params: RequestObjectParams) {
    super();
    this.id = v4();
    this.method = method;
    this.params = params;
  }

  getId(): string {
    return this.id;
  }

  toJson() {
    return {
      jsonrpc: this.jsonrpc,
      id: this.id,
      method: this.method,
      params: this.params,
    };
  }
}
