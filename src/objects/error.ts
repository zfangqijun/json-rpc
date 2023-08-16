class RpcBaseError {
  private code: number;
  private message: string;
  private data?: any;

  constructor(code: number, message: string, data?: any) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  toJson() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

export class ParseError extends RpcBaseError {
  constructor(data?: any) {
    super(-32700, "Parse error", data);
  }
}

export class InvalidRequestError extends RpcBaseError {
  constructor(data?: any) {
    super(-32600, "Invalid Request", data);
  }
}

export class MethodNotFoundError extends RpcBaseError {
  constructor(data?: any) {
    super(-32601, "Method not found", data);
  }
}

export class InvalidParamsError extends RpcBaseError {
  constructor(data?: any) {
    super(-32602, "Invalid params", data);
  }
}

export class InternalError extends RpcBaseError {
  constructor(data?: any) {
    super(-32603, "Internal error", data);
  }
}

export class CustomError extends RpcBaseError {
  constructor(code: number, message: string, data?: any) {
    if (code < -32000 || code > -32099) {
      throw new Error("Custom error code must be between -32000 and -32099");
    }
    super(code, message, data);
  }
}

export type RpcError =
  | ParseError
  | InvalidRequestError
  | MethodNotFoundError
  | InvalidParamsError
  | InternalError
  | CustomError;
