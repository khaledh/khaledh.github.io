# Scope Resolution

The current implementation of the `resolve` method in `IdentReference` is very naive. It
only looks for the first `IdentDecl` element in the file, and returns it if the name
matches the reference. This won't work in a real-world scenario where there could be
multiple matching declarations in the file at different scopes. For example, consider the
following code snippet (we haven't implemented `block` statements yet, but let's assume we
have):

![Identifier Scopes](images/ident-scopes.png =400x)

There are three declarations in this file:
- Line 2: `msg` declaration in a `block` scope. This scope is inaccessible to the `echo`
  statement.
- Line 4: `msg` declaration in the file scope before the reference. This is the correct
  declaration that the reference should resolve to.
- Line 7: `msg` declaration in the file scope after the reference. This scope is also
  inaccessible to the `echo` statement.

We need to change our implementation of the `resolve` method to handle those scoping 
rules.

## Tree Walk-Up

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
  ancestor.
- For each declaration found, the `execute` method of the `PsiScopeProcessor` is called.
  This method is responsible for deciding whether the declaration is the target of the
  reference. This is typically done by comparing the name of the declaration against the
  name of the reference. If a match is found, the `execute` method returns `false` to
  stop the iteration, and the declaration is returned as the result of the `resolve`.
  If a match is not found, the `execute` method returns `true` to continue the iteration.

To better understand the tree walk-up mechanism, let's take a look at the 
implementation of the `treeWalkUp` method from the `PsiTreeUtil` class:

```java
  public static boolean treeWalkUp(@NotNull PsiScopeProcessor processor,
                                   @NotNull PsiElement entrance,
                                   @Nullable PsiElement maxScope,
                                   @NotNull ResolveState state) {
    PsiElement prevParent = entrance;
    PsiElement scope = entrance;

    while (scope != null) {
      if (!scope.processDeclarations(processor, state, prevParent, entrance)) return false;

      if (scope == maxScope) break;
      prevParent = scope;
      scope = prevParent.getContext();
    }

    return true;
  }
```

In a nutshell, the `treeWalkUp` method iterates over the ancestors of the `entrance` 
element, starting with the `entrance` element itself, passing the `processor` instance 
to the `processDeclarations` method of each ancestor. The iteration stops in one of 
two cases:
1. if `processDeclarations` returns `false`, indicating that the target element has 
   been found, or
2. if the `maxScope` is reached (in our case, that would be the top-level `NimFile` 
   element).

On every iteration, the `treeWalkUp` method moves up one level to the next "context" 
of the current element. The `getContext` method is defined in the `PsiElement` 
interface, and by default returns the parent of the element (it delegates to 
`getParent`). However, we're free to override this method in our custom PSI elements 
to return the parent "scope" of the element, which is not necessarily the parent element.

In the example above, if we were to use the default implementation of `getContext`, the 
`treeWalkUp` method would iterate over the following ancestors, in order: `Command` -> 
`Stmt` -> `StmtList` -> `NimFile`. However, when doing scope-based resolution, we can 
skip over intermediate ancestors that don't define their own scope, and only consider 
the ones that do. In this particular example, there's only one scope that we need to
consider: the `NimFile` node. When we implement other scope-defining elements like
`block`, `proc`, `for` loops, etc., we'll consider them as well.

Let's go ahead and implement the `getContext` method for the `IdentRef` element, which 
should return the closest ancestor that defines a scope.

```kotlin
// src/main/kotlin/khaledh/nimjet/psi/impl/IdentRefMixin.kt
...

abstract class IdentRefMixin(node: ASTNode) : ASTWrapperPsiElement(node), IdentRef {

    companion object {
        private val SCOPE_ELEMENT_TYPES = arrayOf(NimFile::class.java)
    }

    override fun getContext(): PsiElement? {
        return PsiTreeUtil.getParentOfType(this, *SCOPE_ELEMENT_TYPES)
    }
    
    ...

}
```

Fortunately, the `PsiTreeUtil` class provides a utility method called `getParentOfType`
that we can use to find the closest ancestor of one of the specified types. Since we're
going to add more scopes later, we define a `SCOPE_ELEMENT_TYPES` array that contains the
classes of the scope-defining elements. So far, we only have the `NimFile` class in the
array.

## Scope Processor

We now know how to find the ancestor scopes of a reference. The next step is to try to 
find the target declaration within each of those scopes, until either the target is 
found or we run out of scopes.

Let's use the example above to illustrate how this works.

- We create an implementation of `PsiScopeProcessor`, let's call it `IdentScopeProcessor`.
  Its `execute` method will compare the name of the declaration against the name of the
  reference, and return `false` if they match (which stops the iteration), and `true`
  otherwise.
- When `resolve` is called on the `IdentRef` node, the `treeWalkUp` method is called,
  passing an instance of `IdentScopeProcessor`.
- The `treeWalkUp` method iterates over the ancestor scopes of the `IdentRef` node,
  starting with the reference element itself. In this particular case, the only  
  ancestor scope is the `NimFile` (as returned by the `getContext` method of the
  `IdentRef` node).
- If any of the ancestors have a `processDeclarations` method, it is called with the  
  `IdentScopeProcessor` instance. In our case, the `NimFile` node will have a
  `processDeclarations` method that will iterate over its children to find the target
  declaration.
- The `NimFile` element knows that it holds a `StmtList` child, so it will delegate the
  `processDeclarations` call to the `StmtList` node.
- The `StmtList` node will iterate over a subset of its children that are of type
  `IdentDecl` (and possibly other declaration types that we haven't implemented yet).
- For each `IdentDecl` node, the `execute` method of the `IdentScopeProcessor` instance is
  called. If the name of the declaration matches the name of the reference, the
  `execute` method will return `false`, which stops the iteration and returns the
  declaration as the result of the `resolve` method.

Note that we will only process the immediate children and not descend into the 
subtrees of those children, as those subtrees would have an inaccessible scope anyway. 

With this in mind, let's implement the `IdentScopeProcessor` class:

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

How it works:
- The `name` of the target declaration to be found is passed to the constructor.
- The `result` field holds the target declaration if found.
- The `execute` method is called for each declaration in the scope. If the name of the
  declaration matches the name of the reference, we set the `result` field to the
  declaration and return `false` to stop the iteration. Otherwise, we return `true` to 
  continue to the next declaration (if any).

Now let's modify the `resolve` method in the `IdentReference` class to use this scope 
processor.

```kotlin
// src/main/kotlin/khaledh/nimjet/psi/IdentReference.kt
...    

class IdentReference(element: IdentRef, textRange: TextRange)
    : PsiReferenceBase<IdentRef>(element, textRange) {

    override fun resolve(): PsiElement? {
        val processor = IdentScopeProcessor(element.text)
        PsiTreeUtil.treeWalkUp(
            processor,              // scope processor
            element,                // entrance element
            element.containingFile, // max scope
            ResolveState.initial()  // initial state
        )
        return processor.result
    }

}
```

The new implementation should be straightforward to understand. We create an instance 
of `IdentScopeProcessor` with the name of the reference, and pass it to the 
`treeWalkUp` method. We also pass the reference element as the entrance element (i.e. 
the starting point of the tree walk-up), and the containing `NimFile` as the maximum 
scope. The `ResolveState.initial()` method creates a `state` object that can be used 
to store additional information during the resolution process (we're not making use of 
it in our case). Finally, we return the `result` field of the `IdentScopeProcessor`, 
whether it's `null` (if the target declaration wasn't found) or the found declaration.

The last missing piece is to implement the `processDeclarations` method in the 
`NimFile` and `StmtList` classes. We'll start with the `StmtList` class, as it's the

---

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
