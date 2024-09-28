# Declaration Sections

In addition to declaring single variables in a declaration statement, Nim also 
supports declaring multiple variables in the same statement using an indented section. 
For example:

```nim
let msg = "hello"   # single declaration

let                 # multiple declarations
  foo = "foo"
  bar = "bar"
```

Now that we have support for indentation in the grammar, we can easily modify the 
`LetSection` rule to support multiple declarations, in addition to the existing single 
declaration.

```bnf
// src/main/kotlin/khaledh/nimjet/parser/Nim.bnf
...

LetSection ::= LET IdentDef
             | LET IND IdentDef (EQD IdentDef)* DED

IdentDef   ::= IdentDecl EQ STRING_LIT
...
```

The `LetSection` rule now has an alternative that allows multiple declarations in an 
indented section, where declarations in the section are separated by `EQD`. I factored 
out a common part of the two alternatives into a separate `IdentDef` rule to avoid 
duplication. Let's test it out.

![Declaration Section](images/decl-section.png =600x)

This looks to be correct. The PSI tree shows two `IdentDef` nodes under the 
`LetSection` node. We are already reaping the benefits of the indentation support we 
added earlier, keeping the grammar clean and easy to read.

## Let, Var, and Const Sections

Nim has three different kinds of variable declarations: `let`, `var`, and `const`. 
They all use the same syntax for declaration, but they have different semantics. Let's 
add similar support for `var` and `const` declarations in the grammar.

```bnf {4-5,12-13,15-16}
...

Stmt         ::= LetSection
               | VarSection
               | ConstSection
               | Command
               | BlockStmt

LetSection   ::= LET IdentDef
               | LET IND IdentDef (EQD IdentDef)* DED

VarSection   ::= VAR IdentDef
               | VAR IND IdentDef (EQD IdentDef)* DED

ConstSection ::= CONST IdentDef
               | CONST IND IdentDef (EQD IdentDef)* DED
...
```

Let's not also forget to add the `var` and `const` keyword tokens to the lexer and the 
`NimToken` class.

```java {7-8}
...

<NORMAL> {
  ...

  "let"                          { return NimToken.LET; }
  "var"                          { return NimToken.VAR; }
  "const"                        { return NimToken.CONST; }

  ...
}
```

Let's test the new `var` and `const` declarations.

![Var and Const Sections](images/var-const-sections.png =600x)

All seems to be working as expected.

## Meta Rules

The `LetSection`, `VarSection`, and `ConstSection` rules are very similar. They only 
differ in the keyword token they use. We can factor out the common parts of these rules
into a _meta rule_, which is a Grammar-Kit construct to define a parameterized rule 
(kind of similar to generics).

A meta rule doesn't define explicit parameters. Instead, it uses an implicit parameter 
`<<p>>` for rules that use a single parameter, or `<<p1>>`, `<<p2>>`, etc., for rules 
that use multiple parameters. To invoke the meta rule, you use the `<<rule_name ...>>` 
syntax, and pass other rules as arguments.

Let's define a meta rule for the variable declaration sections.

```bnf
LetSection           ::= LET <<section IdentDef>>
VarSection           ::= VAR <<section IdentDef>>
ConstSection         ::= CONST <<section IdentDef>>

private meta section ::= <<p>>
                       | IND <<p>> (EQD <<p>>)* DED
```

This is equivalent to the original rules we defined earlier, but with less redundancy.

Let's make another use of meta rules. We've seen the pattern `<<p>> (EQD <<p>>)*` 
before in the `StmtList` rule:

```bnf
StmtList   ::= Stmt (EQD Stmt)*
```

This pattern basically defines a sequence of items separated by a delimiter. We can 
factor this pattern into a meta rule as well, let's call it `list`, and use it both in 
the `StmtList` rule and the `section` meta rule (yes, meta rules can be nested).

```bnf
StmtList             ::= <<list Stmt EQD>>
...

private meta list    ::= <<p1>> (<<p2>> <<p1>>)*
private meta section ::= <<p>>
                       | IND <<list <<p>> EQD>> DED
```

This time, the `list` meta rule takes two parameters: `<<p1>>` and `<<p2>>`. The first 
parameter represents the item to be repeated, and the second parameter represents the 
delimiter. We make use of it in the `StmtList` rule to define a repeated sequence of
`Stmt` nodes separated by `EQD`. We also use it in the `section` meta rule to define a
repeated sequence of `<<p>>` nodes separated by `EQD`.

Another pattern we can factor out is the `IND ... DED` pattern, which defines an 
indented block of code. Let's define an `indented` meta rule for this pattern. We'll 
use it in both the `BlockStmt` rule and the `section` meta rule.

```bnf{2,6,8}
...
BlockStmt  ::= BLOCK COLON <<indented StmtList>>

...

private meta indented ::= IND <<p>> DED
private meta section  ::= <<p>>
                        | <<indented <<list <<p>> EQD>>>>
```

If we test the grammar now, we should see no difference in the behavior, but the grammar
is now much more lean and DRY. Here's the full grammar so far.

```bnf
Module       ::= !<<eof>> StmtList

StmtList     ::= <<list Stmt EQD>>

Stmt         ::= ConstSection
               | VarSection
               | LetSection
               | Command
               | BlockStmt

ConstSection ::= CONST <<section IdentDef>>
LetSection   ::= LET <<section IdentDef>>
VarSection   ::= VAR <<section IdentDef>>

IdentDef     ::= IdentDecl EQ STRING_LIT

Command      ::= IdentRef IdentRef

BlockStmt    ::= BLOCK COLON <<indented StmtList>>

IdentDecl    ::= IDENT
IdentRef     ::= IDENT


// meta rules

private meta list     ::= <<p1>> (<<p2>> <<p1>>)*
private meta indented ::= IND <<p>> DED
private meta section  ::= <<p>>
                        | <<indented <<list <<p>> EQD>>>>
```

We'll make more use of meta rules in the future when we encounter more patterns that 
can be factored out.

## PSI Cleanup

One last thing we can do to clean up the PSI tree a bit is to make the `Stmt` rule 
private. This rule doesn't serve any purpose on its own, other than to group other 
statement rules. Making it private will make the individual statement rules direct 
children of the `StmtList` node in the PSI tree.

```bnf
private Stmt ::= ConstSection
               | ...
```

Let's see what the PSI tree looks like now.

![PSI Tree - No Stmt Nodes](images/psi-no-stmt.png =600x)

This looks much cleaner. The `Stmt` nodes are gone, and we can see the declaration 
sections directly under the `StmtList` node.
