## typeChecker.getShorthandAssignmentValueSymbol()

## TypeChecker.getExportSpecifierLocalTargetSymbol

```
/**
  * シンボルがローカルシンボルで、エクスポートされたシンボルが関連付けられている場合、 エクスポートされたシンボルを返します。
  * それ以外の場合は、その入力を返します。
  * 例えば、`輸出型 T = number;`の場合：
  * T`の位置で `getSymbolAtLocation` を実行すると `T` のエクスポートされたシンボルが返されます。
  * しかし、`getSymbolsInScope`の結果は、`T`の*ローカル*シンボルを含み、エクスポートされたシンボルを含みません。
  * このローカルシンボルに対して `getExportSymbolOfSymbol` を呼び出すと、エクスポートされたシンボルが返されます。
  */
```

typeChecker.getRootSymbos()