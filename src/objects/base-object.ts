import { v4 } from "uuid";
import { RpcErrorJson, RpcError } from "./error";

export interface BaseJson {
  jsonrpc: string;
}

type RequestObjectParams = Record<string, any> | any[];

interface RequestJson extends BaseJson {
  jsonrpc: string;
  id: string;
  method: string;
  params: RequestObjectParams;
}

interface ResponseSuccessJson extends BaseJson {
  id: string;
  result: any;
}

interface ResponseErrorJson extends BaseJson {
  id: string;
  error: RpcErrorJson;
}

export class RpcObject {
  protected jsonrpc: "2.0" = "2.0";

  toJson(): BaseJson {
    return {
      jsonrpc: this.jsonrpc,
    };
  }

  static fromJson(json: RequestJson | ResponseSuccessJson | ResponseErrorJson) {
    if (json.jsonrpc !== "2.0") {
      throw new Error("Invalid jsonrpc version.");
    }
    if (json.hasOwnProperty("method")) {
      return RequestObject.fromJson(json as RequestJson);
    }
    if (json.hasOwnProperty("result")) {
      return ResponseSuccessObject.fromJson(json as ResponseSuccessJson);
    }
    return ResponseErrorObject.fromJson(json as ResponseErrorJson);
  }
}

export class RequestObject extends RpcObject {
  private id: string;
  private method: string;
  private params: RequestObjectParams;

  constructor(method: string, params: RequestObjectParams, id?: string) {
    super();
    this.id = id ?? v4();
    this.method = method;
    this.params = params;
  }

  getId(): string {
    return this.id;
  }

  getMethod(): string {
    return this.method;
  }

  getParams(): RequestObjectParams {
    return this.params;
  }

  toJson() {
    return {
      jsonrpc: this.jsonrpc,
      id: this.id,
      method: this.method,
      params: this.params,
    };
  }

  static fromJson(json: RequestJson) {
    return new RequestObject(json.method, json.params, json.id);
  }
}

export class ResponseSuccessObject extends RpcObject {
  private id: string;
  private result?: any;

  constructor(id: string, result?: any) {
    super();
    this.id = id;
    this.result = result;
  }

  getId(): string {
    return this.id;
  }

  getResult(): any {
    return this.result;
  }

  toJson() {
    return {
      jsonrpc: this.jsonrpc,
      id: this.id,
      result: this.result,
    };
  }

  static fromJson(json: ResponseSuccessJson) {
    return new ResponseSuccessObject(json.id, json.result);
  }
}

export class ResponseErrorObject extends RpcObject {
  private id: string;
  private error: RpcError;

  constructor(id: string, error: RpcError) {
    super();
    this.id = id;
    this.error = error;
  }

  getId(): string {
    return this.id;
  }

  getError(): RpcError {
    return this.error;
  }

  toJson() {
    return {
      jsonrpc: this.jsonrpc,
      id: this.id,
      error: this.error.toJson(),
    };
  }

  static fromJson(json: ResponseErrorJson) {
    return new ResponseErrorObject(json.id, RpcError.fromJson(json.error));
  }
}
