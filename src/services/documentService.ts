class DocumentService {
  static instance: DocumentService;
  private visibilityListener?: () => void;
  private _isDocumentHidden = false;

  static getInstance() {
    if (!this.instance) {
      this.instance = new DocumentService();
    }
    return this.instance;
  }

  listenDocumentVisibility() {
    if (this.visibilityListener) {
      return;
    }

    this.visibilityListener = () => {
      this._isDocumentHidden = document.hidden;
    };

    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  get isDocumentHidden() {
    return this._isDocumentHidden;
  }
}

export const documentService = DocumentService.getInstance();
