export class ThenValueConverter {
  toView(value, thenValue, elseValue = "") {
    return value ? thenValue : elseValue;
  }
}

