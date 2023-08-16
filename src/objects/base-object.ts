export abstract class RpcBaseObject {
  protected jsonrpc: "2.0" = "2.0";

  abstract toJson(): object;

  static fromJson(json: object): RpcBaseObject {
    throw new Error("Not implemented");
  }
}
