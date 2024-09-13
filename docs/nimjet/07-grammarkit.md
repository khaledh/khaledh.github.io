# Grammar-Kit

Grammar-Kit is a JetBrains plugin for generating a parser (and a lexer, if needed) 
from a grammar specification file that uses a BNF-like syntax. Not only does it 
generate the parser, but it also generates the PSI classes of the language. This is a 
huge time-saver, as it allows us to focus on the language syntax and semantics rather 
than the parsing details.

## The BNF File

The grammar specification file is written in a BNF-like syntax. The file two types of 
sections: an **attributes** section and a **grammar rules** section. The attributes
section allows us to customize the generated parser and PSI classes, while the grammar
rules section defines the language syntax. Here's a simple example of such a BNF file:

```bnf
// Attributes
{
  parserClass="generated.MyParser"
}

// Grammar
Root      ::= BEGIN (MyStmt SEMI)* END
MyStmt    ::= PrintStmt
            | ...
PrintStmt ::= PRINT STRING_LIT
```

In the attributes section we specified the fully qualified name of the parser class that
will be generated. In the grammar section, we defined the syntax of a simple language that
consists of a `BEGIN` keyword followed by a sequence of statements separated by
semicolons (the `SEMI` token), and ending with an `END` keyword. The `PrintStmt` rule
defines a statement that consists of a `PRINT` keyword followed by a string literal.

There are no restrictions on the names of the rules or the tokens, but here I'm 
adopting the following convention:
- Rule names are in `PascalCase` (those are intermediate nodes in the AST)
- Token names are in `UPPER_SNAKE_CASE` (those are leaf nodes in the AST)

## Generating the Parser

To generate the parser, we can right-click on the grammar file and select the
**Generate Parser Code** action. This will generate the parser and lexer classes under the
`src/main/gen` directory (as opposed to the `src/main/kotlin` directory where we have our
handwritten code). By default, Grammar-Kit generates the following set of classes:

```tree
src/main/gen
└── generated
    ├── psi
    │   ├── impl
    │   │   ├── MyStmtImpl.java
    │   │   └── PrintStmtImpl.java
    │   ├── MyStmt.java
    │   ├── PrintStmt.java
    │   └── Visitor.java
    ├── MyParser.java
    └── GeneratedTypes.java
```

For PSI, Grammar-Kit generates pairs of interfaces and implementation classes for each
rule in the grammar. For example, the `PrintStmt` rule will have an interface `PrintStmt`
and an implementation class `PrintStmtImpl`. The `Visitor` interface is used to traverse
the PSI tree, and the `GeneratedTypes` class contains the token and rule element types
(extending `IElementType`). It also contains an inner `Factory` class with a single method
`createElement` that creates the appropriate PSI element for a given AST node (used by 
the `ParserDefinition.createElement()` method to create PSI elements).

We can also ask Grammar-Kit to generate a lexer for us by right-clicking on the grammar
file and selecting the **Generate JFlex Lexer** action. This will generate the lexer
specification file, but we have to select the location where we want to save it - let's
say we save it under `src/main/gen/generated` as `MyLexer.flex` (alongside the generated
parser and PSI). Now we can right-click on the lexer file and select the **Run JFlex
Generator** action, which will generate the lexer class `MyLexer` under the 
`src/main/gen/generated` directory. So, in addition to the above files, we will have:

```tree
src/main/gen
└── generated
    ├── ...
    ├── MyLexer.flex
    └── MyLexer.java
```

While generating the lexer is convenient, it is not flexible enough for complex languages
that require custom lexing rules (like Nim). So, we will keep our handwritten lexer and
tokens, and tell Grammar-Kit to use them instead.

We also won't need a visitor class for now, so we'll tell Grammar-Kit not to generate 
it as well.

## A Simple Nim BNF

Let's create a BNF file for Nim that would parse the `echo "hello, world"` statement that
we used in the previous sections.

```bnf
{
    generate=[tokens="no" visitor="no"]

    parserClass="khaledh.nimjet.parser.NimParser"
    parserImports="static khaledh.nimjet.lexer.NimToken.*"

    elementTypeClass="khaledh.nimjet.parser.NimElementType"
    elementTypeHolderClass="khaledh.nimjet.parser.NimElement"

    psiPackage="khaledh.nimjet.psi"
    psiImplPackage="khaledh.nimjet.psi.impl"
}

Root    ::= !<<eof>> NimStmt
NimStmt ::= IDENTIFIER STRING_LIT
```

In the attributes section, we specified:
- that we don't want Grammar-Kit to generate tokens or a visitor class
- the fully qualified name of the `NimParser` class that will be generated
- the parser imports that we need, which are the token types from our lexer
- the fully qualified name of the element type class `NimElementType` that we created 
  previously; Grammar-Kit will use this class to create instances of the AST element types
- the class that will hold the instances of the element types: `NimElement`
- the package names for the PSI and PSI implementation classes

In the grammar section, we defined the syntax of a simple Nim file that consists of a
single statement, which is an identifier followed by a string literal.

Notice the `!<<eof>>` syntax in the `Root` rule. The `<<...>>` syntax is used to invoke an
external rule defined in parser, which in this case is the built-in `eof` rule that
matches the end of the file. The `!` operator negates the rule, so having `!<<eof>>`
at the beginning of the `Root` rule won't match an empty file. This prevents the parser
from generating an error when the file is empty.

## Generating the Nim Parser

Now we can right-click on the Nim BNF file and select the **Generate Parser Code** action
to generate the parser classes. We will end up with the following set of classes:

```tree
src/main/gen
└── khaledh/nimjet
    ├── parser
    │   ├── NimElement.java
    │   └── NimParser.java
    └── psi
        ├── impl
        │   └── NimStmtImpl.java
        └── NimStmt.java
```

Our handwritten part of the parser should be structured as follows, under the 
`src/main/kotlin` directory:

```tree
src/main/kotlin
└── khaledh/nimjet
    ...
    ├── parser
    │   ├── Nim.bnf
    │   ├── NimElementType.kt
    │   └── NimParserDefinition.kt
    └── psi
        └── NimFile.kt    
```

And to complete the organization, we should have the lexer and the various language 
plugin classes also tidied up as follows:

```tree
src/main/kotlin
└── khaledh/nimjet
    ├── lang
    │   ├── NimFileType.kt
    │   ├── NimIcons.kt
    │   └── NimLanguage.kt
    ├── lexer
    │   ├── Nim.flex
    │   ├── NimLexerAdapter.java
    │   ├── NimToken.kt
    │   └── NimTokenType.kt
    ├── parser
    │   ...
    └── psi
        ...
```

If we test the plugin now, we should have the same functionality as before, but with the
parser generated by Grammar-Kit in this case. As a final step, let's automate 
generating the parser using the Gradle build script, as we did with the lexer.

```kts{9-15,19,23}
// build.gradle.kts
...

tasks {
    generateLexer {
        ...
    }

    generateParser {
        sourceFile = file("src/main/kotlin/khaledh/nimjet/parser/Nim.bnf")
        targetRootOutputDir = file("src/main/gen/khaledh/nimjet")
        pathToParser = "parser"
        pathToPsiRoot = "psi"
        purgeOldFiles = true
    }

    compileJava {
        dependsOn(generateLexer)
        dependsOn(generateParser)
    }
    compileKotlin {
        dependsOn(generateLexer)
        dependsOn(generateParser)
    }
}
```

This should take care of generating the parser whenever we build the project, so we 
don't have to manually run the Grammar-Kit action every time we change the BNF file 
(unless we need to inspect the generated code, of course).
