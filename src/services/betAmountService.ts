import { AmountWidgets } from '~/widgets/amountWidgets';

class BetAmountService {
  static instance: BetAmountService;
  private amountWidgets: AmountWidgets | null = null;
  private showAmount = false;

  static getInstance() {
    if (!this.instance) {
      this.instance = new BetAmountService();
    }
    return this.instance;
  }

  setWidget(widget: AmountWidgets | null): void {
    this.amountWidgets = widget;
  }

  getWidget(): AmountWidgets | null {
    return this.amountWidgets;
  }

  setShow({ status }: { status: boolean }) {
    this.showAmount = status;
  }

  getShow(): boolean {
    return this.showAmount;
  }
}

export const betAmountService = BetAmountService.getInstance();
