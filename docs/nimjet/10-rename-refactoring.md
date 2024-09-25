# Rename Refactoring

Now that we have support for scope-based reference resolution, let's add support for 
rename refactoring. This will allow users to rename a symbol and have all references to
that symbol updated automatically.

## Supporting Rename

The IDE supports rename refactoring for elements that implement the `PsiNamedElement` 
interface by calling their `setName` method. This method should create a new identifier
element with the new name, and replace the existing identifier element with the new one.

Creating a new identifier element is not straightforward, as it requires creating a new
`PsiElement` instance backed by a new `ASTNode`. We'll need to create a dummy 
`PsiFile` from a text fragment that contains the new identifier, let the IDE parse the
file, and extract the identifier element from the resulting `PsiFile`.

Let's create a `NimElementFactory` class that will help us create new elements. We'll
add a pair of `createIdentDecl` and `createIdentRef` methods to create new identifier
declarations and references, respectively. We will use the former in the `setName`
method of our `IdentDecl` element, and the latter in the `handleElementRename` method of
our `IdentReference` element.

```kotlin
// src/main/kotlin/khaledh/nimjet/psi/NimElementFactory.kt
...

class NimElementFactory {

    companion object {

        private fun createFile(project: Project, text: String): NimFile {
            return PsiFileFactory
                .getInstance(project)
                .createFileFromText("dummy.nim", NimFileType, text) as NimFile
        }

        fun createIdentDecl(project: Project, name: String): IdentDecl {
            val file = createFile(project, "let $name = \"\"")
            return PsiTreeUtil.findChildOfType(file, IdentDecl::class.java)
                ?: throw IncorrectOperationException("Failed to create new IdentDecl element")
        }

        fun createIdentRef(project: Project, name: String): IdentRef {
            val file = createFile(project, "$name dummy")
            return PsiTreeUtil.findChildOfType(file, IdentRef::class.java)
                ?: throw IncorrectOperationException("Failed to create new IdentRef element")
        }

    }
}
```

The `createFile` method creates a new `NimFile` instance from a text fragment. The
`createIdentDecl` method uses this method to create a new file containing the fragment
`let $name = ""`, where `$name` is the new identifier name. This creates a new identifier
declaration element with the specified name. We then extract the `IdentDecl` element from
the file and return it.

The `createIdentRef` method is similar, but it creates a file containing the fragment
`$name dummy`, where `$name` is the new identifier name. This creates a new identifier
reference element, which we extract and return.

Now, let's use the `createIdentDecl` method in the `IdentDeclMixin` class to implement 
the `setName` method.

```kotlin
// src/main/kotlin/khaledh/nimjet/psi/impl/IdentDeclMixin.kt
...

abstract class IdentDeclMixin(node: ASTNode) : ASTWrapperPsiElement(node), IdentDecl {
    ...

    override fun setName(name: String): PsiElement {
        val newIdentDecl = NimElementFactory.createIdentDecl(project, name)
        ident.replace(newIdentDecl.ident)
        return this
    }

    ...
}
```

After we create the new `IdentDecl` element, we replace the existing identifier token 
(the `ident` property) with the new `ident` token from the new declaration. This 
updates the identifier name in the declaration.

Now, let's implement the `handleElementRename` method in the `IdentReferenceMixin` 
class to rename references to the identifier.

```kotlin
// src/main/kotlin/khaledh/nimjet/psi/IdentReference.kt
...

class IdentReference(element: IdentRef, textRange: TextRange)
    : PsiReferenceBase<IdentRef>(element, textRange) {
    ...

    override fun handleElementRename(newElementName: String): PsiElement {
        val newIdentRef = NimElementFactory.createIdentRef(myElement.project, newElementName)
        myElement.ident.replace(newIdentRef.ident)
        return myElement
    }

    ...
}
```

This time we create a new `IdentRef` element using the `createIdentRef` method and replace
the existing identifier token with the new one. Notice that `IdentReference` is a 
`PsiReference` object, not the `IdentRef` element itself. We use the `myElement` 
property to access the `IdentRef` element.

This should be enough to support rename refactoring. Let's try it out by putting the 
cursor on the inner declaration of the `msg` variable and pressing `Shift + F6` to 
rename it. We can also right-click on the declaration and select `Refactor -> Rename...
` from the context menu.

![Rename Dialog](images/rename-dialog.png =600x)

The IDE shows a dialog where we can enter the new name. We enter `innerMsg` and press
`Enter`. The IDE updates the declaration and all references to the variable.

![Renamed Identifier](images/renamed-identifier.png =350x)

Great! Both the inner declaration and the reference to the variable have been updated. 

## In-place Rename

The IDE also supports in-place rename refactoring, where we can rename an identifier
directly in the editor, instead of using the dialog. This feature relies on registering
a class that extends `RefactoringSupportProvider` and registering it in the `plugin.xml`.
This class enables many refactoring features (e.g. rename, introduce variable, extract 
method, etc.), but we'll focus only on the rename refactoring for now.

Let's create a `NimRefactoringSupportProvider` class and override the 
`isInplaceRenameAvailable` method to enable in-place rename refactoring.

```kotlin
// src/main/kotlin/khaledh/nimjet/refactoring/NimRefactoringSupportProvider.kt
...

class NimRefactoringSupportProvider : RefactoringSupportProvider() {

    override fun isInplaceRenameAvailable(element: PsiElement, context: PsiElement?): Boolean {
        return element.useScope is LocalSearchScope
    }

}
```

The IDE has two handlers for in-place rename refactoring: local and global.

- The local one is `VariableInplaceRenameHandler`, and it requires the element to have a 
`LocalSearchScope` use scope. Local search scope is typically associated with local 
  variables (which include variables at the file scope that are not exported), 
  and function parameters. This handler passes the element to our 
  `isInplaceRenameAvailable` method to determine if in-place rename is available for 
  that element.
- The global one is `MemberInplaceRenameHandler`, and it can handle elements with a
  `GlobalSearchScope` use scope. This scope is typically associated with public classes, 
  functions, variables, and other symbols that can be accessed from other files. 
  This handler passes the element to the `isMemberInplaceRenameAvailable` method of 
  the `RefactoringSupportProvider` class to check if in-place rename is available for 
  that element.

In our case, we only need the local in-place rename handler, so we override only the
`isInplaceRenameAvailable` method. For this to work though, we need to modify our 
`IdentDecl` element to have a `LocalSearchScope` use scope. Let's do that in the 
`IdentDeclMixin` class.

```kotlin
...

abstract class IdentDeclMixin(node: ASTNode) : ASTWrapperPsiElement(node), IdentDecl {
    ...

    override fun getContext(): PsiElement? = NimScope.parentScope(this)

    override fun getUseScope(): SearchScope = LocalSearchScope(context ?: containingFile)

}
```

The `getUseScope` method returns a `LocalSearchScope` constrained to the element's 
parent context, or the containing file if the context is null. This limits the scope of
the in-place rename refactoring to the element's scope.

Finally, let's register the `NimRefactoringSupportProvider` class in the `plugin.xml` 
file.

```xml
<idea-plugin>
    ...

    <extensions defaultExtensionNs="com.intellij">
        ...

        <lang.refactoringSupport
            language="Nim"
            implementationClass="khaledh.nimjet.refactoring.NimRefactoringSupportProvider"/>

    </extensions>

</idea-plugin>
```

## Testing In-place Rename

Let's test the in-place rename refactoring by putting the cursor on the `msg` 
variable declaration in the block scope and pressing `Shift + F6`. Both the 
declaration and the reference to the variable should become editable with a purple 
background. If we start typing, the IDE should update the declaration and all
references to the variable in sync.

![In-place Rename](images/inplace-rename.png =420x)

Looks good! Now, let's try to rename the other `msg` variable declaration (at the file 
scope). Notice that I changed the string literal value to `"msg"` as well. When we start 
the in-place renaming, the IDE will show a popover to ask if we want to rename the 
occurrences in the string literal as well.

![In-Place Rename String Occurrences](images/inplace-rename-string.png =430x)

Let's choose **Rename all occurrences** and start typing. The IDE should update all
occurrences of the variable, including the string literal. Neat!

![In-Place Rename String Occurrences](images/inplace-rename-string-occ.png =400x)

That's it for rename refactoring. In the next section, we'll add support for **Find 
Usages**, which will allow us to find all references to a symbol and display the 
results in a tool window.

