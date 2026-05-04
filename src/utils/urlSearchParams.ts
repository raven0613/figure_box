export class URLSearchParamsWithHelpers extends URLSearchParams {
  private searchUrl: string;

  constructor(url: string) {
    super(url);
    this.searchUrl = url;
  }

  getWithError(key: string) {
    const value = this.get(key);

    if (value === null) {
      throw Error(`"${key}" key is not included in ${this.searchUrl} params`);
    }

    return value;
  }
}
