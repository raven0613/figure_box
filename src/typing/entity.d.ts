interface Entity<T, P = string> {
  id: P;
  data: T;
  createdAt: Date;
  updatedAt: Date;
}
