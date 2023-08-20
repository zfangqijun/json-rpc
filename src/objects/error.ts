export interface RpcErrorJson {
  code: number;
  message: string;
  data?: any;
}

export class RpcError {
  private code: number;
  private message: string;
  private data?: any;

  constructor(code: number, message: string, data?: any) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  toJson(): RpcErrorJson {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }

  static fromJson(json: RpcErrorJson) {
    if (json.code === -32700) return new ParseError(json.data);
    if (json.code === -32600) return new InvalidRequestError(json.data);
    if (json.code === -32601) return new MethodNotFoundError(json.data);
    if (json.code === -32602) return new InvalidParamsError(json.data);
    if (json.code === -32603) return new InternalError(json.data);
    return new RpcError(json.code, json.message, json.data);
  }
}

export class ParseError extends RpcError {
  constructor(data?: any) {
    super(-32700, "Parse error", data);
  }
}

export class InvalidRequestError extends RpcError {
  constructor(data?: any) {
    super(-32600, "Invalid Request", data);
  }
}

export class MethodNotFoundError extends RpcError {
  constructor(data?: any) {
    super(-32601, "Method not found", data);
  }
}

export class InvalidParamsError extends RpcError {
  constructor(data?: any) {
    super(-32602, "Invalid params", data);
  }
}

export class InternalError extends RpcError {
  constructor(data?: any) {
    super(-32603, "Internal error", data);
  }
}

export class CustomError extends RpcError {
  constructor(code: number, message: string, data?: any) {
    if (code < -32000 || code > -32099) {
      throw new Error("Custom error code must be between -32000 and -32099");
    }
    super(code, message, data);
  }
}
