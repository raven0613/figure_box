import {
  createActor,
  type AnyStateMachine,
  type Actor,
  type Subscription,
  type EventFromLogic,
  type ContextFrom,
  type StateValueFrom,
  type SnapshotFrom,
} from 'xstate';

export abstract class StateServiceBase<TMachine extends AnyStateMachine> {
  protected machine: TMachine;
  protected interpreter?: Actor<TMachine>;
  private contextChangeSubscription?: Subscription;
  private stateTransitionSubscription?: Subscription;

  constructor(machine: TMachine) {
    this.machine = machine;
  }

  public initial() {
    this.interpreter = createActor(this.machine);
    this.interpreter.start();
  }

  public getActor() {
    if (!this.interpreter) {
      throw new Error('Please call initial method to start interpreter first!');
    }

    return this.interpreter;
  }

  public getContext(): ContextFrom<TMachine> {
    return this.getActor().getSnapshot() as ContextFrom<TMachine>;
  }

  public getState(): StateValueFrom<TMachine> {
    return this.getActor().getSnapshot() as StateValueFrom<TMachine>;
  }

  public onContextChange(callback: (state: SnapshotFrom<TMachine>) => void) {
    this.contextChangeSubscription?.unsubscribe();
    this.contextChangeSubscription = this.getActor().subscribe(
      callback as (state: SnapshotFrom<TMachine>) => void
    );
  }

  public send(event: EventFromLogic<TMachine>) {
    this.getActor().send(event);
  }

  public onStateTransition(callback: (state: SnapshotFrom<TMachine>) => void) {
    this.stateTransitionSubscription?.unsubscribe();
    this.stateTransitionSubscription = this.getActor().subscribe(
      callback as (state: SnapshotFrom<TMachine>) => void
    );
  }
}
