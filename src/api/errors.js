export class ServiceLayerError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'ServiceLayerError'
    this.status = status
    this.code = code
  }
}
