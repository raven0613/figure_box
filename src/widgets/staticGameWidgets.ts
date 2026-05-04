

export class StaticGameWidgets {
  private staticWidgets: Array<any>;
  constructor(staticWidgets: Array<any>) {
    this.staticWidgets = staticWidgets;
  }

  draw() {
    this.staticWidgets.forEach(widget => widget.draw());
  }
}
