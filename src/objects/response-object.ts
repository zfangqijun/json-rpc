import { RpcError } from "./error";
import { RpcBaseObject } from "./base-object";

export class ResponseSuccessObject extends RpcBaseObject {
  private id: string;
  private result?: any;

  constructor(id: string, result?: any) {
    super();
    this.id = id;
    this.result = result;
  }

  toJson() {
    return {
      jsonrpc: this.jsonrpc,
      id: this.id,
      result: this.result,
    };
  }
}

export class ResponseErrorObject extends RpcBaseObject {
  private id: string;
  private error: RpcError;

  constructor(id: string, error: RpcError) {
    super();
    this.id = id;
    this.error = error;
  }

  toJson() {
    return {
      jsonrpc: this.jsonrpc,
      id: this.id,
      error: this.error.toJson(),
    };
  }
}
