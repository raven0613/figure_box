

export interface InteractiveGameWidgetType {
}

export class InteractiveGameWidget {
  private interactiveWidgets: InteractiveGameWidgetType;
  constructor(interactiveWidgets: InteractiveGameWidgetType) {
    this.interactiveWidgets = interactiveWidgets;
  }

  getInteractiveWidgets() {
    return this.interactiveWidgets;
  }

  draw() {
    const widgets: Array<SelectChipsField | GameRoundText | UserCoin> = [
      ...Object.values(this.interactiveWidgets),
    ];

    widgets.forEach(widget => widget.draw());
  }
}
