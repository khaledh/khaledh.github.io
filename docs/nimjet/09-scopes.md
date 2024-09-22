# Scope Resolution

The current implementation of the `resolve` method in `IdentReference` is very naive. It
only looks for the first `IdentDecl` element in the file, and returns it if the name
matches the reference. This won't work in a real-world scenario where there could be
multiple matching declarations in the file at different scopes. We need to implement a
proper scope resolution mechanism to find the correct declaration for a reference.

The IntelliJ platform provides a mechanism for scope-based resolution. It's a bit
complex, but it allows us to define custom scopes and resolve references within those
scopes. It works as follows:

- When `resolve` is called on a reference, we perform a _tree walk-up_ to find the
  _scope_ in which the reference is resolved. The `PsiTreeUtil.treeWalkUp` utility method
  can be used for this purpose. This method takes an instance of `PsiScopeProcessor`
  interface that is responsible for deciding whether a particular element is the
  target of the reference.
- The `treeWalkUp` method iterates over the ancestors of the reference element, and
  calls a `processDeclarations` method on each of them, passing the `PsiScopeProcessor`
  instance.
- For each of the ancestors, their respective `processDeclarations` method is called.
  This method is responsible for finding the declarations in the scope of that
  ancestor. Finding those declarations may involve descending into the children of the
  ancestor.
- For each declaration found, the `execute` method of the `PsiScopeProcessor` is called.
  This method is responsible for deciding whether the declaration is the target of the
  reference. This is typically done by comparing the name of the declaration against the
  name of the reference. If a match is found, the `execute` method returns `false` to
  stop the iteration, and the declaration is returned as the result of the `resolve`.
  If a match is not found, the `execute` method returns `true` to continue the iteration.

Let's use the PSI tree above to illustrate how this works.

- We create an implementation of `PsiScopeProcessor`, let's call it `IdentScopeProcessor`.
  Its `execute` method will compare the name of the declaration against the name of the
  reference, and return `false` if they match, and `true` otherwise.
- When `resolve` is called on the `IdentRef` node, the `treeWalkUp` method is called,
  passing an instance of `IdentScopeProcessor`.
- The `treeWalkUp` method iterates over the ancestors of the `IdentRef` node, starting
  with the reference element itself. In this particular case, the ancestors are:
  `Command` -> `Stmt` -> `StmtList` -> `NimFile`.
- If any of the ancestors have a `processDeclarations` method, it is called with the
  `IdentScopeProcessor` instance.
- In our case, to locate the target element, we need to walk up to the `StmtList` node,
  and then descend into its children to find the target `IdentDecl`. The intermediate
  ancestors don't have any declarations, so we won't implement `processDeclarations` for
  them (at least for now).
- The `processDeclarations` method of `StmtList` will iterate over any `IdentDecl`
  descendants and call the `execute` method of `IdentScopeProcessor` on each of them.
  The `execute` method will compare the name of the declaration against the name of the
  reference, and return `false` if they match, and `true` otherwise.

There's a problem with this approach though. What if the declaration is in a different
scope than the reference? For example, consider the following code snippet (we haven't
implemented `block` statements yet, but let's assume we have):

```nim
block:
  let msg = "hello"

echo msg
```

In this case, the `msg` declaration is in a `block` statement, which has its own scope
that is not visible to the `echo` statement. To avoid incorrectly resolving the
reference to that declaration, we need to stop the descent into the children of the
ancestor if we traverse into a scope that is not an ancestor of the reference. We can
do this by using the `PsiTreeUtil.isAncestor` method to check if the current element
is an ancestor of the reference.

Another problem is that when we descend into the children of an ancestor, we need to skip
previously visited subtrees. For example, the first step of the tree walk-up is to visit
the `Command` node. Then, when we visit the `Stmt` node, we don't want to visit the
`Command` node again. The `processDeclarations` method takes a `lastParent` parameter that
we can use to keep track of the last parent (i.e. ancestor) we visited while walking up
the tree. We can then use this parameter when descending into the children to skip over
previously visited subtrees.

A third problem is the case when the declaration comes _after_ the reference in the
file. Consider the following code snippet:

```nim
echo msg
let msg = "hello"
```

In this case, the `msg` declaration comes after the reference. We need to make sure that
we don't resolve the reference to this declaration. To do this, we need to stop
considering children of the ancestor if they come after the reference in the file. TODO.

---

Let's start by implementing the `IdentScopeProcessor` class:

  ```kotlin
// src/main/kotlin/khaledh/nimjet/psi/IdentScopeProcessor.kt
...

class IdentScopeProcessor(private val name: String) : PsiScopeProcessor {
    var result: PsiElement? = null

    override fun execute(element: PsiElement, state: ResolveState): Boolean {
        if (element is IdentDecl && element.name == name) {
            result = element
            return false
        }
        return true
    }

}
```