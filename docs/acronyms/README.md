---
title: Computing Acronyms
sidebarDepth: 1
---

# Computing Acronyms

Acronyms common in computing, hacker culture, and everyday software engineering conversations. This
section collects concise definitions and quick examples to help you grok the jargon fast. A note
about the legacy/historical subsections:

- **Legacy**: outdated but still in use.
- **Historical**: obsolete, mostly of historical interest.

<div class="acronyms">

## Software Architecture

| Acronym | Meaning | Example |
| --- | --- | --- |
| C4 | Context–Container–Component–Code — lightweight hierarchical diagramming model for communicating software architecture at multiple levels of abstraction. | Draw a system Context and Container diagram for a web app; break a service into Components; optionally add Code-level diagrams. |
| CQRS | Command Query Responsibility Segregation — separate writes/reads. | Write model emits events; read model is a projection. |
| EDA | Event-Driven Architecture — async event-based systems. | Publish domain events to Kafka; services react. |
| ECS | Entity Component System — decompose game and simulation logic into data-only components processed by systems operating on matching entities. | Game engine with `Position`/`Velocity` components updated by a `PhysicsSystem`; rendering system consumes `Mesh` components. |
| ES | Event Sourcing — persist state changes as an append‑only log of events and rebuild current state by replaying them. | Order aggregate applies `OrderPlaced`/`ItemAdded` events; projections update read models. |
| SOA | Service-Oriented Architecture — collaborating services. | Decompose monolith into services. |
| **Legacy** {colspan=3} |
| COM | Component Object Model — Microsoft binary-interface standard for reusable components with reference counting and interface-based polymorphism. | Query `IUnknown`/`IDispatch`; register COM servers; Office automation via COM. |
| DCOM | Distributed COM — extension of COM for inter-process and cross-machine communication using RPC. | Remote COM server activation/config over the network using DCOMCNFG. |
| ESB | Enterprise Service Bus — centralized integration/message bus with mediation, routing, and governance typical of classic SOA; considered heavyweight today. | Hub‑and‑spoke integration; replaced by microservices and event streaming (Kafka). |
| SOAP | XML-based messaging protocol for web services. | Enterprise integrations over SOAP. |
| **Historical** {colspan=3} |
| CORBA | Common Object Request Broker Architecture — OMG standard for language- and platform-neutral distributed objects communicating via an Object Request Broker. | Define interfaces in IDL; ORB uses IIOP for interop between stubs and skeletons.

## Software Design

| Acronym | Meaning | Example |
| --- | --- | --- |
| AoS | Array of Structs — contiguous collection where each element stores all fields, offering good spatial locality for per-entity operations. | `struct Particle { float x, y, z; } particles[N];` iterate once to update position/velocity. |
| CPS | Continuation-Passing Style — express control flow by passing an explicit continuation function instead of returning normally. | `f(x, k)` calls `k(result)`; enables tail calls, trampolines, async composition. |
| CSP | Communicating Sequential Processes — formal concurrency model where independent processes interact solely via message‑passing over channels (no shared memory). | Go channels/`select` and occam are CSP‑inspired; model systems as processes and rendezvous on channels. |
| DDD | Domain-Driven Design — model around the domain. | Ubiquitous language in code and docs. |
| DI | Dependency Injection — provide dependencies from the outside rather than creating them inside. | Pass a `Logger` to a service constructor instead of instantiating it. |
| DIP | Dependency Inversion Principle — depend on abstractions, not concretions. | Accept a `Logger` interface, not a concrete `ConsoleLogger`. |
| DRY | Don't Repeat Yourself — avoid duplicating knowledge in code and docs. | Extract a function instead of pasting the same block twice. |
| DTO | Data Transfer Object — simple data container. | Map entities to DTOs for API responses. |
| FRP | Functional Reactive Programming — model time‑varying values and event streams with functional operators. | UI state as RxJS Observables using `map/merge/switchMap`. |
| ISP | Interface Segregation Principle — prefer many small, client‑specific interfaces. | Use `Readable`/`Writable` instead of a bloated `File` interface. |
| KISS | Keep It Simple, Stupid — prefer simple solutions that meet requirements. | Use a plain function instead of a custom class hierarchy. |
| LSP | Liskov Substitution Principle — subtypes must be substitutable for their base. | A subclass shouldn't strengthen preconditions or weaken postconditions. |
| MVC | Model–View–Controller — separate data, presentation, and control flow. | Controllers orchestrate; Views render; Models hold domain data. |
| MVVM | Model–View–ViewModel — bind UI to a ViewModel that exposes state/actions. | Two-way binding in front-end frameworks. |
| OCP | Open/Closed Principle — open for extension, closed for modification. | Add a new strategy class instead of editing a switch. |
| SoA | Struct of Arrays — layout that keeps each field in its own contiguous array to enable SIMD/vectorization and cache-friendly columnar processing. | Separate `x[N]`, `y[N]`, `z[N]` arrays for particles to update components with wide vector loads. |
| SoC | Separation of Concerns — isolate responsibilities into distinct modules. | Keep validation, business logic, and persistence in separate layers. |
| SOLID | Five OO design principles: SRP, OCP, LSP, ISP, DIP. | Extract interfaces and inject dependencies via constructors. |
| SRP | Single Responsibility Principle — one reason to change. | Split parsing and rendering into separate classes. |
| UML | Unified Modeling Language — notation to visualize/design systems. | Class and sequence diagrams for architecture and behavior. |
| WET | Write Everything Twice — tongue-in-cheek opposite of DRY. | Duplicate code rather than refactor. |
| YAGNI | You Aren't Gonna Need It — don't build features until necessary. | Skip a caching layer until profiling shows the need. |

## Software Engineering

| Acronym | Meaning | Example |
| --- | --- | --- |
| BDD | Behavior-Driven Development — specify behavior in examples (Given/When/Then). | Feature files drive implementation and acceptance tests. |
| BDUF | Big Design Up Front — invest in upfront architecture/design before implementation. | Comprehensive UML/specs prior to coding (vs iterative/agile). |
| CD | Continuous Delivery/Deployment — automated release pipeline to ship safely. | Tagging main triggers a production deploy. |
| CI | Continuous Integration — frequently merge to main with automated tests. | Every PR runs unit and integration tests in CI. |
| CI/CD | Combined practice of Continuous Integration and Delivery/Deployment. | Build, test, artifact, deploy stages in one pipeline. |
| DX | Developer Experience — overall quality of tools, workflows, and docs that make developers productive and happy. | One‑command setup, fast feedback loops, clear errors, great CLIs. |
| DSC | Desired State Configuration — declarative configuration management approach that defines the target state and lets tooling converge systems to it continually. | PowerShell DSC or Azure Automanage enforces web server configs by applying declarative manifests and reporting drift. |
| E2E | End-to-End — tests or flows that cover the full user journey across systems and components. | Cypress/Playwright tests from UI through API to DB.
| EOL | End Of Life — product/version no longer supported with fixes or updates; plan upgrades before EOL to remain secure and compliant. | Ubuntu 20.04 reaches EOL → migrate to 22.04 LTS.
| GA | General Availability — broad production release status following beta/RC; officially supported. | Mark v1.0 as GA and enable default rollout.
| HCI | Human-Computer Interaction — discipline focused on designing, evaluating, and implementing user interfaces and human-centered systems. | Usability studies, prototyping flows, accessibility reviews for a new feature. |
| I18N | Internationalization — design for multiple languages/locales. | Externalize strings; ICU formatting; locale-aware dates/numbers. |
| KPI | Key Performance Indicator — metric tracking performance toward a goal. | Conversion rate, p95 latency, crash-free sessions. |
| L10N | Localization — adapt an internationalized product for a locale. | Translate resources; RTL layout; localized units/images. |
| LTS | Long-Term Support — release line maintained with security/critical fixes for an extended period. | Choose Node.js LTS for production; receive patches without feature churn. |
| MVP | Minimum Viable Product — smallest thing to deliver value/learning. | Ship a CLI prototype before a full GUI. |
| MQ | Merge Queue — automation that sequences merges and runs required checks on up-to-date commits so main stays green. | GitHub/GitLab merge queue rebases the next PR onto main, runs CI, and auto-merges when green. |
| OKR | Objectives and Key Results — align goals and track outcomes. | Company-level objectives with measurable KRs. |
| PoC | Proof of Concept — quick prototype to validate feasibility. | Spike code to test a new database driver. |
| PR | Pull Request — propose code change for review/merge. | Open a PR for CI checks and team review. |
| QA | Quality Assurance — practices to ensure product quality via process and testing. | Test plans, manual/exploratory testing, and sign-off before release. |
| RAD | Rapid Application Development — iterative, prototyping‑focused approach emphasizing quick delivery and user feedback over heavy upfront planning. | Build a working prototype with low‑code/4GL tools and iterate with users. |
| RC | Release Candidate — build believed to be release‑ready, pending final validation. | Ship RC to staging for UAT and smoke tests. |
| RFC | Request For Comments — proposal/spec for feedback before adoption. | RFC for a breaking API change. |
| SCM | Source Control Management — processes/tools for tracking changes to source code and related assets; often used interchangeably with VCS. | Git as an SCM; branching strategies, code reviews, and CI integration.
| SDLC | Software Development Life Cycle — structured process for planning, designing, building, testing, deploying, and maintaining software. | Phases: requirements → design → implementation → testing → deployment → maintenance. |
| SWE | Software Engineer — practitioner who designs, builds, tests, and maintains software systems. | Full‑stack SWE implementing features, writing tests, and doing code reviews. |
| TDD | Test-Driven Development — write a failing test, pass it, refactor. | Red → Green → Refactor per behavior. |
| UAT | User Acceptance Testing — end users validate requirements. | Business stakeholders test before release. |
| UI | User Interface — the visual and interactive surface users operate. | Screens, components, and controls in web/mobile apps. |
| UX | User Experience — usability and satisfaction. | Research, UX writing, usability testing. |
| VCS | Version Control System — track changes to code and collaborate. | Git (branches, commits, PRs), Mercurial. |
| WIP | Work In Progress — items in progress; limit to improve flow. | Cap WIP per Kanban column. |
| XP | Extreme Programming — agile practices emphasizing feedback/simplicity. | Pair programming, CI, refactoring, and TDD. |

## Web Development

| Acronym | Meaning | Example |
| --- | --- | --- |
| AJAX | Asynchronous JavaScript and XML — async HTTP from the browser. | Fetch data without full page reload. |
| CMS | Content Management System — application for creating, managing, and publishing website content, often with roles, workflows, and plugins; headless CMS expose content via APIs. | WordPress/Drupal; headless CMS like Contentful/Sanity. |
| CSR | Client-Side Rendering — render in the browser via JS. | React SPA renders views on the client. |
| CSS | Cascading Style Sheets — style language for HTML. | Tailwind/vanilla CSS styles pages. |
| DOM | Document Object Model — tree for HTML/XML. | `document.querySelector()` manipulates nodes. |
| ES | ECMAScript — JavaScript specification. | ES2023 features. |
| GraphQL | Query language/runtime for typed APIs. | Client requests specific fields only. |
| HTML | HyperText Markup Language — web markup. | `<div>`, `<a>`, `<section>` structure pages. |
| JS | JavaScript — language of the web. | Frontend apps, Node.js scripts. |
| LTR | Left-To-Right — text direction where writing proceeds from left to right; default for Latin scripts. | HTML `dir="ltr"`; ensure proper bidi handling with Unicode markers where needed. |
| NPM | Node Package Manager — default package manager and registry client for Node.js, distributing JavaScript packages and managing project dependencies/scripts. | `npm install react` adds dependencies; `package.json` defines scripts run via `npm run build`. |
| OpenAPI | Standard to describe HTTP APIs (Swagger). | Generate clients from `openapi.yaml`. |
| PWA | Progressive Web App — offline/installable web app. | Add service worker and manifest. |
| REST | Representational State Transfer — resource APIs. | `GET /posts/42` returns a Post. |
| RTL | Right-To-Left — text direction where writing proceeds from right to left; used by scripts like Arabic and Hebrew. | HTML `dir="rtl"`; use logical CSS properties (`margin-inline-start`) for bidi layouts.
| SEO | Search Engine Optimization — improve visibility/traffic. | Add metadata; optimize content. |
| SPA | Single Page Application — dynamic single page. | React/Vue app with client routing. |
| SSR | Server-Side Rendering — render HTML on server. | Next.js SSR pages. |
| TS | TypeScript — typed superset of JavaScript that compiles to plain JS. | Add static types/interfaces; transpile with `tsc` or bundlers. |
| UA | User Agent — identifier string a client sends describing the software, version, and sometimes device/OS. | HTTP `User-Agent` header; spoof/rotate UA for testing/scraping. |
| URI | Uniform Resource Identifier — generic identifier for names/addresses of resources; includes URLs (locators) and URNs (names). | `mailto:hello@example.com`, `urn:isbn:9780143127796`, `https://example.com/`. |
| URL | Uniform Resource Locator — reference (address) to resources on a network using a scheme, host, and path. | `https://example.com/docs/index.html`. |
| URN | Uniform Resource Name — a URI that names a resource without specifying its location; persistent, location‑independent identifiers. | `urn:isbn:9780143127796`, `urn:uuid:123e4567-e89b-12d3-a456-426614174000`. |
| WASM | WebAssembly — portable fast binary format. | Run Rust/C++ in the browser. |
| WWW | World Wide Web — system of interlinked hypertext documents and resources accessed via the internet using HTTP(S) and URLs. | Browse websites over HTTPS with a web browser. |
| **Legacy** {colspan=3} |
| CGI | Common Gateway Interface — standard for web servers to execute external programs and generate dynamic content. | Apache invoking a CGI script to render a page. |
| XHR | XMLHttpRequest — legacy browser API for making HTTP requests from JavaScript (superseded by `fetch`). | `xhr.open('GET', '/api')`; handle `onreadystatechange`.

## Programming

| Acronym | Meaning | Example |
| --- | --- | --- |
| AAA | Arrange–Act–Assert — unit testing pattern that structures tests into setup (arrange inputs/fixtures), execution (act), and verification (assert expected outcomes). | Arrange a service and mocks; Act by calling the method; Assert on result and interactions. |
| ADT | Abstract Data Type — specification of behavior independent of implementation. | Stack/queue ADTs with array- or list-based implementations. |
| ADT | Algebraic Data Type — composite types formed by sums (variants) and products (fields), enabling expressive, type-safe modeling. | Rust enums/Haskell data types; Option/Either in FP. |
| API | Application Programming Interface — a defined surface for one piece of software to interact with another. | POSIX file APIs, a graphics library API, or an HTTP endpoint. |
| AVL | Adelson-Velsky and Landis tree — self‑balancing binary search tree that maintains height balance via rotations to ensure O(log n) search/insert/delete. | Implement an ordered map/set with AVL rotations (LL/LR/RL/RR). |
| BFS | Breadth-First Search — graph/tree traversal that visits neighbors level by level using a queue; finds shortest paths in unweighted graphs. | Level-order traversal of a tree; BFS from a source to compute distances/parents. |
| BSP | Binary Space Partitioning — recursively subdivide space with hyperplanes (planes in 3D, lines in 2D) to organize geometry for visibility, rendering order, and collision queries. | Classic FPS engines (e.g., Quake) use BSP trees for visibility/culling and painter's algorithm ordering. |
| BST | Binary Search Tree — ordered binary tree supporting average O(log n) search/insert/delete when balanced; worst‑case O(n) if unbalanced. | Implement sets/maps; inorder traversal yields keys in sorted order. |
| CAS | Compare-And-Swap — atomic operation that updates a memory location only if it still equals an expected value; foundation for lock‑free algorithms. | CAS loop for a lock‑free stack push; beware the ABA problem. |
| CLI | Command-Line Interface — text-based commands. | `git`, `kubectl`, custom CLIs. |
| CLR | Common Language Runtime — .NET VM. | Runs C# assemblies. |
| CRUD | Create, Read, Update, Delete — basic data ops. | REST endpoints map to CRUD on `users`. |
| CUI | Character User Interface — text/character-based UI typically rendered in terminals with limited graphics; overlaps with TUI. | Installer wizards and ncurses-style menus in a terminal. |
| DAG | Directed Acyclic Graph — directed graph with no cycles; commonly used to model dependencies and enable topological ordering in compilers, build systems, and task scheduling. | Topologically sort to order compilation units; represent dependencies in build graphs or AST passes. |
| DFS | Depth-First Search — graph/tree traversal that explores as far as possible along each branch before backtracking; typically implemented with recursion or an explicit stack. | Topological sort, cycle detection, connected components, subtree times. |
| DSL | Domain-Specific Language — tailored language. | SQL, Regex, build DSLs. |
| EOF | End Of File — no more data to read. | Read returns EOF on file end. |
| FFI | Foreign Function Interface — mechanism to call functions across language/ABI boundaries. | Rust `extern "C"` to call C; Python `ctypes`/`cffi` bindings. |
| FIFO | First In, First Out — queue discipline. | Message queues processing order. |
| FP | Functional Programming — pure functions/immutability. | Map/filter/reduce pipelines. |
| FSM | Finite State Machine — computational model with a finite number of states and transitions driven by inputs/events. | UI workflows, protocol handlers, and parsers modeled as FSMs. |
| GADT | Generalized Algebraic Data Type — ADT whose constructors can refine the result type, enabling more precise typing and safer pattern matches. | Haskell/OCaml GADTs for typed ASTs; matching narrows types. |
| GC | Garbage Collection — automatic memory management. | JVM/CLR collectors free unused objects. |
| gRPC | High-performance RPC over HTTP/2 with Protobuf. | Define `.proto`; generate client/server stubs. |
| GUI | Graphical User Interface — visual interaction. | Desktop app windows, buttons. |
| I/O | Input/Output — transfer of data to/from a program and external systems or devices. | File I/O, network I/O; blocking vs non‑blocking/async I/O. |
| IDE | Integrated Development Environment — all-in-one dev app. | IntelliJ, VS Code (w/ extensions). |
| IDL | Interface Definition Language — specification language to describe interfaces and data types for generating cross-language bindings and IPC stubs. | Define COM interfaces in MIDL or CORBA IDL; generate proxies/stubs for RPC.
| IIFE | Immediately Invoked Function Expression. | `(function(){ })()` in JS. |
| JDBC | Java Database Connectivity — DB API. | `DriverManager.getConnection(...)`. |
| JDK | Java Development Kit — Java dev tools. | `javac`, `jar`. |
| JRE | Java Runtime Environment — run Java apps. | `java -jar app.jar`. |
| JVM | Java Virtual Machine — runs bytecode. | JVM-based languages (Kotlin, Scala). |
| LRU | Least Recently Used — cache eviction policy that discards the least recently accessed items first. | LRU caches/maps in memory-constrained systems. |
| LSB | Least Significant Bit — the bit with the lowest positional value in a binary number (2^0); determines odd/even and is affected first by increment. | In 0b1011, the LSB is 1; little‑endian stores LSB byte first. |
| LSP | Language Server Protocol — standard JSON-RPC protocol between editors and language servers for code intelligence. | VS Code/Neovim language servers for hover, completion, diagnostics. |
| MSB | Most Significant Bit — the bit with the highest positional value; often used as the sign bit in signed integers. | In 0b1011, the MSB is 1; big‑endian stores MSB byte first. |
| MST | Minimum Spanning Tree — subset of edges that connects all vertices in a weighted, undirected graph with minimum total weight and no cycles. | Compute MST with Kruskal (sort edges + DSU) or Prim (priority queue). |
| NaN | Not a Number — IEEE 754 floating‑point special value representing undefined/invalid results; propagates through computations and is unordered (not equal to any value, including itself). | `0.0/0.0` or `sqrt(-1.0)` produce NaN; `NaN != NaN` is true; use `isnan()` to test. |
| NOP | No Operation — instruction or operation that intentionally does nothing; used for timing, alignment, patching, or as a placeholder. | CPU `NOP` instruction; inserting a no‑op in pipelines or bytecode. |
| NPE | Null Pointer Exception — runtime error arising from dereferencing a null reference/pointer in languages with nullable references. | Java `NullPointerException`, C# `NullReferenceException`; avoid with null checks, Option/Optional, or null‑safety features. |
| ODBC | Open Database Connectivity — cross-platform C API and driver model for accessing relational databases. | Configure DSNs; apps connect via ODBC drivers to SQL Server/MySQL/Postgres. |
| OLE | Object Linking and Embedding — Microsoft technology (built on COM) for embedding and linking documents/objects between applications. | Embed an Excel sheet in a Word doc; OLE automation for Office apps. |
| OOM | Out Of Memory — condition where available memory is exhausted and allocations fail. | Linux OOM killer terminates processes; runtime throws OOM error. |
| OOP | Object-Oriented Programming — encapsulation/inheritance/polymorphism. | Classes, interfaces, virtual methods. |
| ORM | Object-Relational Mapping — map objects to relational tables. | ORM entities and repositories. |
| PCRE | Perl Compatible Regular Expressions — regex libraries and syntax compatible with Perl's regex engine (PCRE/PCRE2). | `grep -P`, nginx, PHP use PCRE/PCRE2 for advanced regex features.
| RAII | Resource Acquisition Is Initialization — lifetime control. | C++ locks released at scope end. |
| REPL | Read–Eval–Print Loop — interactive shell. | Python/Node REPL. |
| RPC | Remote Procedure Call — call functions on a service. | gRPC `CreateUser` method. |
| RPN | Reverse Polish Notation — postfix notation for arithmetic expressions that eliminates parentheses and associates operators with operands directly; naturally evaluated with a stack. | Evaluate `3 4 + 2 *` with a stack; HP calculators and some compilers/VMs use RPN internally. |
| SDK | Software Development Kit — tools/libs for a platform. | AWS SDK for programmatic access. |
| SUT | System Under Test — the specific component or boundary being exercised by a test, often isolated from collaborators via test doubles. | Unit test drives the SUT (a service class) while stubbing its repository and asserting outputs/interactions. |
| TLS | Thread-Local Storage — per-thread storage for data that gives each thread its own instance of a variable. | C/C++ `thread_local`/`__thread`, POSIX `pthread_key_create`; Rust `thread_local!`.
| TUI | Text-based User Interface — terminal UI. | `htop`, `ncurses` apps. |
| UB | Undefined Behaviour — program operations for which the language standard imposes no requirements, allowing compilers to assume they never happen and enabling aggressive optimizations. | C/C++ out‑of‑bounds access, use‑after‑free, signed overflow; can lead to unpredictable results; use sanitizers to detect.
| UTC | Coordinated Universal Time — global time standard. | Timestamps/logs in UTC. |
| WYSIWYG | What You See Is What You Get — direct-manipulation editor. | Rich text editors. |
| **Historical** {colspan=3} |
| RMI | Remote Method Invocation — Java's distributed objects technology enabling method calls on remote JVMs via stubs/skeletons over JRMP (or IIOP for RMI‑IIOP). | Early Java distributed systems; largely supplanted by HTTP/REST, gRPC, and message queues.

## Compilers

| Acronym | Meaning | Example |
| --- | --- | --- |
| AOT | Ahead-Of-Time compilation — compile before runtime. | Angular AOT compiles templates during build. |
| AST | Abstract Syntax Tree — structured tree representation of parsed source code used by compilers and tooling. | AST nodes for statements/expressions in parsers/linters. |
| BNF | Backus–Naur Form — notation for expressing context‑free grammars used to define programming language syntax. | Language specs define grammar productions in BNF or EBNF. |
| CFG | Context‑Free Grammar — formal grammar class used to define programming language syntax; typically expressed in BNF/EBNF and parsed by LL/LR/GLR/PEG parsers. | Write grammar productions; generate parsers with yacc/bison/ANTLR.
| CFG | Control Flow Graph — directed graph of basic blocks and edges representing possible control transfers within a function/program; foundation for data‑flow analysis and many optimizations. | Build CFG to compute dominators/loops; enable DCE, SSA construction, and liveness. |
| CSE | Common Subexpression Elimination — remove repeated identical expressions by computing once and reusing the value within a region. | Within a block, compute `x+y` once and reuse; global variants extend across blocks. |
| DCE | Dead Code Elimination — remove code shown by analysis to have no effect on program outputs/side effects, improving size and performance. | Eliminate unused assignments/branches after liveness/constant propagation; `-O2` passes in LLVM/GCC. |
| DFA | Data Flow Analysis — family of static analyses that compute facts about program variables/paths over a control flow graph using lattice/transfer functions (e.g., reaching definitions, liveness, constant propagation). | Run forward/backward analyses on a CFG; feed results to optimizations like DCE, CSE, and register allocation. |
| DFA | Deterministic Finite Automaton — finite-state machine with exactly one transition per symbol for each state; used in lexers/pattern matching. | Tokenizer state machine generated from regular languages. |
| DWARF | Debug With Arbitrary Record Format — standardized debugging information format for compiled programs (types, symbols, line tables, call frames) used across platforms. | GCC/Clang emit DWARF in ELF/Mach-O; inspect with `readelf --debug-dump` or `llvm-dwarfdump`; GDB/LLDB consume DWARF. |
| EBNF | Extended Backus–Naur Form — BNF with additional operators (repetition, optional, grouping) for more concise grammar specifications. | `{ }` repetition, `[ ]` optional; used in many language grammars and docs. |
| FAM | Flexible Array Member — language/ABI feature where a struct’s last field is a size‑unspecified array used to tail‑allocate variable‑length data; not counted in `sizeof` and requires custom allocation/copy logic. | In C (C99+): `struct S{size_t n; int a[];};` allocate with `malloc(sizeof(struct S)+n*sizeof(int))`; `a` occupies trailing storage. |
| GCC | GNU Compiler Collection — suite of compilers for C/C++/Fortran and more. | `gcc`/`g++` toolchains for building software. |
| GVN | Global Value Numbering — discover semantically equivalent computations (beyond syntactic equality) to eliminate redundancies across the dominator tree. | Treat `t=x; z=t+y` as `x+y`; coalesce values through copies/φ nodes in SSA. |
| IR | Intermediate Representation — compiler/transformation-friendly program form between source and machine code. | LLVM IR, SSA-based IRs used for optimization. |
| JIT | Just-In-Time compilation — runtime optimization. | HotSpot JIT compiles hot methods. |
| LICM | Loop-Invariant Code Motion — hoist computations whose operands don’t change within a loop to preheaders, and sink post‑loop where safe. | Move `len(arr)`/`c*2` out of the loop body to reduce work. |
| LLVM | Low Level Virtual Machine — modular compiler toolchain and IR used by many languages. | Clang/LLVM backends, `llc`, `opt`, and LLVM IR. |
| LTO | Link Time Optimization — whole‑program optimization performed at link time across translation units, typically by linking IR/bitcode and running interprocedural passes. | `-flto` in Clang/GCC; enables cross‑TU inlining, DCE, devirtualization, ICF/WPO.
| NFA | Nondeterministic Finite Automaton — automaton model for regular languages allowing ε‑transitions and multiple possible next states; typically converted to an equivalent DFA for efficient matching. | Build NFA from regex via Thompson's construction; convert to DFA by subset construction for lexers.
| NRVO | Named Return Value Optimization — compiler optimization that elides copies/moves by constructing a named local return object directly in the caller’s storage. | `T f(){ T x; return x; }` constructs `x` in the caller (C++); differs from RVO on unnamed temporaries.
| PEG | Parsing Expression Grammar — recognition‑based grammar formalism with ordered (prioritized) choice and unlimited lookahead; often parsed via packrat parsing with memoization for linear time. | Define a PEG for a language and parse with PEG.js/pest/PEGTL; use ordered choice instead of ambiguous CFGs. |
| PRE | Partial Redundancy Elimination — inserts computations to make partially redundant expressions fully redundant, then removes duplicates (often via Lazy Code Motion/SSA-PRE). | If `a+b` happens on some paths and later unconditionally, place it optimally so all uses share one computed value. |
| RTTI | Run-Time Type Information — runtime facility to query an object's dynamic type and perform safe downcasts/instance checks in languages with polymorphism. | In C++, use `dynamic_cast<Base*>` and `typeid`; in Java/C#, use `instanceof`/`is` and reflection APIs.
| RVO | Return Value Optimization — compiler optimization that elides copies/moves by constructing a returned temporary directly in the caller’s storage. | `T f(){ return T(); }` constructs the `T` in the caller; guaranteed in C++17 (copy elision rules).
| SSA | Static Single Assignment — IR form where each variable is assigned exactly once, using φ (phi) functions at merge points; simplifies data‑flow analysis and optimization. | Convert to SSA to enable efficient DCE, copy propagation, and value numbering; SSA in LLVM IR. |
| TCO | Tail Call Optimization — reuse the current stack frame for a tail call to avoid stack growth and enable efficient tail recursion. | Compilers transform tail-recursive functions into loops; mandated in some languages (Scheme), optional in others. |
| UFCS | Uniform Function Call Syntax — language feature that allows calling free/extension functions with method-call syntax by implicitly passing the receiver as the first argument. | D/Scala/Rust desugar `x.f(y)` to `f(x, y)`; extension methods in C#/Kotlin/Swift. |

## Operating Systems

| Acronym | Meaning | Example |
| --- | --- | --- |
| ABI | Application Binary Interface — low-level contract governing calling conventions, data layout, and linkage between compiled code and the OS/runtime. | x86‑64 System V ABI, Windows x64 ABI; stable FFI boundaries. |
| APK | Android Package Kit — archived bundle (ZIP with `AndroidManifest.xml`, resources, and compiled bytecode) used to distribute and install Android apps. | Build `app-release.apk`, sign it, and install with `adb install` or upload to Play. |
| ASLR | Address Space Layout Randomization — security technique that randomizes process address spaces (stack/heap/ASLR-enabled libs) to make memory corruption exploits less reliable. | `cat /proc/sys/kernel/randomize_va_space`; Windows system-wide ASLR. |
| BAT | Batch file — Windows Command Prompt script file executed by `cmd.exe`; commonly `.bat` or `.cmd`. | Automation scripts using built-ins like `echo`, `set`, `if`, `for`. |
| BSS | Block Started by Symbol — segment for zero‑initialized or uninitialized static/global data that occupies memory at load/runtime but takes no space in the object file beyond metadata (size). | C `static int buf[4096];` goes to `.bss`; reduces binary size versus storing zeros. |
| CMD | Windows Command Prompt — command-line interpreter (`cmd.exe`) for Windows providing batch scripting (.bat/.cmd) and built-in shell commands. | Run `cmd.exe`; use `dir`, `copy`, `set` and `%PATH%`; legacy scripts for automation. |
| COW | Copy-On-Write — share pages or objects until a write occurs, then copy to preserve isolation; reduces memory/IO and enables efficient forks/snapshots. | `fork()` shares pages COW; VM snapshots; filesystem COW in ZFS/Btrfs. |
| DLL | Dynamic-Link Library — shared library format on Windows loaded at runtime into a process address space. | `foo.dll` loaded via LoadLibrary; shared code/plugins. |
| DYLIB | Dynamic Library — macOS shared library format loaded by the dynamic linker. | `libfoo.dylib` via dyld; `install_name_tool`/rpaths for relocation. |
| ELF | Executable and Linkable Format — standard binary format for executables, object files, and shared libraries on Unix-like systems. | Linux binaries with sections/segments; inspect with `readelf`/`objdump`. |
| EXE | Executable file — Windows program file using the Portable Executable (PE) format for executables and DLLs. | Launch `.exe` apps; inspect PE headers with `dumpbin`/`objdump`. |
| FAT | File Allocation Table — simple filesystem used historically and for removable media; variants FAT12/16/32. | USB stick formatted as FAT32 for broad compatibility; firmware update drives. |
| FS | File System — on-disk or logical structure and set of rules the OS uses to organize, store, and retrieve files/directories, including metadata and allocation. | ext4, NTFS, APFS, ZFS; mount/unmount volumes; permissions and journaling.
| FUSE | Filesystem in Userspace — kernel interface to implement filesystems in user space processes. | Mount `sshfs`/`rclone` via FUSE; custom FS without kernel modules. |
| GNOME | GNU Network Object Model Environment — free, open‑source desktop environment for UNIX-like systems, part of the GNU Project. | Default desktop on many Linux distributions; GNOME Shell with Wayland/X11. |
| HAL | Hardware Abstraction Layer — OS layer that hides hardware specifics behind a uniform API so drivers/system code can run across platforms. | Windows HAL; OS kernels providing common driver interfaces across architectures.
| IPC | Inter-Process Communication — exchange/coordinate between processes. | Pipes, sockets, shared memory, signals. |
| ISR | Interrupt Service Routine — function invoked by the OS in response to an interrupt to handle the event and acknowledge the controller. | Keyboard ISR on IRQ1 reads scancode; timer ISR updates ticks and EOIs the APIC. |
| KDE | K Desktop Environment (now the KDE community and Plasma desktop) — free, open‑source desktop environment and software suite for UNIX-like systems. | KDE Plasma on Linux/BSD; highly configurable desktop with KWin and Qt apps. |
| Mach-O | Mach Object — executable/object file format used by macOS/iOS for binaries and libraries. | Inspect with `otool`/`lldb`; `libfoo.dylib` and `foo.app/Contents/MacOS/foo`. |
| NTFS | New Technology File System — Windows journaling filesystem with ACLs, alternate data streams, compression, and quotas. | Format a Windows system volume as NTFS; set ACLs with icacls. |
| OS | Operating System — system software that manages hardware resources and provides common services for programs. | Linux, Windows, macOS; kernel, drivers, processes, filesystems. |
| PE | Portable Executable — Windows binary format for executables, DLLs, and object files. | Inspect with `dumpbin`/`objdump`; sections, import/export tables. |
| PID | Process Identifier — numeric ID assigned by the kernel to a process. | `pid=1` init/systemd; `ps -o pid,comm`. |
| POSIX | Portable OS Interface — Unix-like standard APIs. | `fork`, `exec`, `pthread` APIs. |
| PTY | Pseudo Terminal — virtual terminal pair (master/slave) used by terminal emulators and remote sessions to emulate a real TTY. | `/dev/pts/*`, `ssh -t`, `forkpty`, `tmux`.
| RTOS | Real-Time Operating System — OS designed for deterministic response and bounded latency, with priority-based scheduling and real-time primitives. | FreeRTOS, Zephyr, VxWorks on microcontrollers/embedded systems; hard vs soft real-time. |
| SO | Shared Object — Unix/Linux shared library format loaded by the dynamic linker. | `libfoo.so` via ld.so/`dlopen`; sonames and rpaths. |
| SUS | Single UNIX Specification — standard defining UNIX interfaces and behavior maintained by The Open Group, ensuring POSIX compliance and application portability. | SUS/POSIX APIs (`unistd.h`, signals, threads); conformant systems like AIX, HP‑UX, macOS. |
| TID | Thread Identifier — numeric ID for a thread (often equals PID for single-threaded processes; Linux has per-thread TIDs). | `gettid()` on Linux; `pthread_self()` maps to a TID. |
| TTY | Teletype/Terminal — character device for text I/O; terminal sessions. | `/dev/tty`, PTY in shells. |
| **Legacy** {colspan=3} |
| AIX | IBM's UNIX (Advanced Interactive eXecutive) for POWER systems, featuring LPARs, SMIT, JFS2, and enterprise tooling. | IBM Power Systems running AIX on POWER9/POWER10; manage with SMIT/VIOS. |
| COM | DOS executable — simple flat binary loaded at offset 0x100 with ~64KB segment limit and no header. | Classic `.COM` utilities/programs on MS‑DOS/PC‑DOS; tiny loaders/stubs. |
| HP-UX | Hewlett-Packard's UNIX for PA‑RISC and Itanium systems with LVM/VxFS and enterprise features. | HP Integrity servers running HP‑UX; SAM/SMH administration; Serviceguard clusters. |
| MCP | Master Control Program — Unisys mainframe OS in the Burroughs large‑systems line, featuring a stack machine architecture and strong language support; still in use but niche. | Unisys ClearPath MCP systems (Burroughs B5000 lineage) running enterprise workloads. |
| NT | New Technology — Microsoft’s NT family/architecture underlying Windows NT and its successors (2000/XP/Vista/7/8/10/11), featuring a hybrid kernel, HAL, NTFS, and Win32/NT native subsystems. | Windows NT lineage; `ver` shows NT versioning; services/session model and security based on NT architecture. |
| UAC | User Account Control — Windows elevation and consent mechanism to limit silent privilege escalation. | Admin tasks prompt for consent; split‑token admin accounts. |
| UDS | Unix Domain Socket — IPC mechanism using socket endpoints on the local host with filesystem pathnames or abstract namespace. | `/var/run/docker.sock`; faster than TCP on localhost. |
| UNIX | Family of multiuser, multitasking operating systems originating at Bell Labs; basis for POSIX and many modern OSes. | Unix philosophy; shells, processes, files; ancestors to Linux, BSD, macOS. |
| VFS | Virtual File System — OS abstraction layer that provides a uniform API over different filesystems and devices. | Linux VFS layer exposes common inode/dentry APIs across ext4, XFS, NFS, FUSE. |
| VM | Virtual Memory — OS abstraction that gives processes isolated address spaces mapped to physical memory via paging/segmentation. | Per‑process address spaces, page tables, demand paging, copy‑on‑write. |
| X11 | X Window System (Version 11) — network‑transparent windowing system and protocol for bitmap displays on UNIX‑like systems. | Xorg/XWayland on Linux; XQuartz on macOS; `ssh -X` X11 forwarding. |
| z/OS | IBM's mainframe operating system for IBM Z, successor to OS/390 and MVS; provides JES2/3, RACF security, JCL batch, and UNIX System Services (POSIX environment). | Enterprise workloads on IBM Z mainframes; partitioned datasets, CICS/IMS, and USS shells. |
| ZFS | Zettabyte File System — advanced filesystem/volume manager with snapshots, checksums, compression, and COW semantics. | Create ZFS datasets/pools; instant snapshots/`zfs send` replication. |
| **Historical** {colspan=3} |
| CDE | Common Desktop Environment — classic UNIX desktop environment based on Motif and the X Window System; widely used on commercial UNIX workstations in the 1990s. | HP‑UX, Solaris, AIX shipped CDE as the default desktop; superseded by GNOME/KDE. |
| CP/M | Control Program for Microcomputers — early microcomputer OS preceding MS‑DOS. | 1970s/80s 8‑bit systems running CP/M. |
| CTSS | Compatible Time-Sharing System — pioneering time-sharing OS developed at MIT for the IBM 7090/7094; introduced concepts like password logins and interactive command shells; precursor to Multics. | MIT Project MAC on IBM 7094; early 1960s interactive computing. |
| DG/UX | Data General's UNIX for AViiON servers/workstations; SVR4-based, multi-processor support; discontinued. | DG AViiON systems running DG/UX; enterprise UNIX of the 1990s. |
| DOS | Disk Operating System — family of disk‑based OSes. | MS‑DOS, PC‑DOS, DR‑DOS. |
| IRIX | SGI's UNIX for MIPS workstations/servers; renowned for graphics and the original home of XFS; discontinued. | SGI Octane/Onyx systems running IRIX; MIPSpro toolchain; legacy SGI graphics stacks. |
| MULTICS | Multiplexed Information and Computing Service — influential time‑sharing OS from MIT/GE/Bell Labs that inspired many UNIX concepts. | 1960s/70s mainframes; security and modular design influenced Unix. |
| OS/2 | IBM/Microsoft then IBM OS succeeding DOS. | OS/2 Warp on 1990s PCs. |
| SVR4 | System V Release 4 — AT&T/Sun UNIX unifying System V, BSD, and Xenix features; foundation for many 1990s commercial UNIXes. | Solaris 2.x and UnixWare derive from SVR4 with STREAMS networking and SVR4 package tools. |
| TSR | Terminate and Stay Resident — DOS resident utility/program. | Keyboard macros/clock TSRs in MS‑DOS. |
| VMS | Virtual Memory System — DEC's operating system for VAX (later Alpha/Itanium as OpenVMS), featuring robust clustering and security. | VAX/VMS in enterprises; OpenVMS clusters with RMS/DCL.

## Document Markup

| Acronym | Meaning | Example |
| --- | --- | --- |
| LaTeX | Document preparation system built on TeX that provides high‑level markup for typesetting complex documents (sections, figures, bibliographies) with excellent math support. | Write papers/books with LaTeX classes/packages; `pdflatex`/`xelatex` build pipelines.
| MD | Markdown — lightweight plain‑text markup language for formatting documents with simple syntax for headings, lists, emphasis, links, and code. | `README.md`, GitHub Flavored Markdown; code fences ``` ``` and tables in docs/blogs.
| RST | reStructuredText — plaintext markup language used in the Python ecosystem and Sphinx documentation generator; emphasizes readable source and structured directives. | Sphinx `.rst` docs with directives/roles; PyPI/ReadTheDocs project documentation. |
| TeX | Low‑level typesetting system designed by Donald Knuth providing precise control over layout and mathematics; foundation for LaTeX and many formats. | Typeset math-heavy documents; `plain TeX` macros; outputs DVI/PDF via engines like pdfTeX/XeTeX/LuaTeX. |
| XML | Extensible Markup Language — verbose structured data. | XML configs, SOAP payloads. |
| XSLT | Extensible Stylesheet Language Transformations — declarative language for transforming XML documents using template rules, XPath selection, and functions. | Transform DocBook/XML to HTML/PDF with Saxon/Xalan; XSLT 1.0/2.0/3.0. |
| **Legacy** {colspan=3} |
| DTD | Document Type Definition — schema language defining the legal structure/elements/attributes of SGML/XML documents. | Validate XML with a DTD; `<!DOCTYPE ...>` declarations; legacy vs XML Schema/Relax NG. |
| **Historical** {colspan=3} |
| SGML | Standard Generalized Markup Language — meta-language for defining markup languages; foundation for HTML/XML; rarely used directly today. | SGML-based HTML 2.0/3.2 era; modern stacks use XML/HTML5 instead.

## File Formats

| Acronym | Meaning | Example |
| --- | --- | --- |
| DVI | Device Independent file format — TeX's output format describing pages and typeset content in a device‑agnostic way, later converted to PostScript/PDF or displayed via drivers. | Generate `.dvi` from TeX; view/convert with `dvips`, `dvipdfmx`, or viewers like xdvi. |
| PDF | Portable Document Format — fixed‑layout document format combining text, vector graphics, and images. | Generate reports/invoices; fillable forms; print‑ready docs. |
| PNG | Portable Network Graphics — lossless raster image format with DEFLATE compression, alpha transparency, and gamma/metadata support. | `.png` UI assets/screenshots; better compression than BMP; supports transparency.
| PS | PostScript — page description language and programming language used primarily in desktop publishing and printing workflows. | Generate vector/print-ready `.ps` files; printers interpret PostScript directly; PDF evolved from it.
| SVG | Scalable Vector Graphics — XML-based vector image format for resolution-independent graphics. | Inline icons/diagrams in HTML; CSS/SMIL animations. |
| TOML | Tom's Obvious, Minimal Language — minimal configuration format with clear semantics. | `pyproject.toml`, `Cargo.toml` tool configs. |
| TTF | TrueType Font — outline font format using quadratic Bézier curves; widely supported across operating systems and browsers. | `.ttf` fonts for desktop/web (often inside `.ttc` collections or wrapped as WOFF/WOFF2 for the web).
| YAML | Human-friendly serialization format. | `docker-compose.yml` files. |
| **Legacy** {colspan=3} |
| BMP | Bitmap Image File — raster image format (Device‑Independent Bitmap) storing pixel data with optional RLE compression. | `.bmp` screenshots/icons; large files compared to PNG/JPEG. |
| RTF | Rich Text Format — plain-text document format with markup (control words and groups) for character/paragraph styling; widely supported across editors. | Save/export `.rtf` from word processors to interchange formatted text. |

## Data Encodings

| Acronym | Meaning | Example |
| --- | --- | --- |
| ASCII | American Standard Code for Information Interchange — 7‑bit character encoding defining codes 0–127; subset of UTF‑8. | Plain ASCII text files; printable characters and control codes. |
| BOM | Byte Order Mark — optional Unicode signature at the start of a text stream indicating endianness/encoding (UTF‑8/UTF‑16/UTF‑32). | Avoid UTF‑8 BOM in Unix scripts; UTF‑16 LE files start with FE FF. |
| CRLF | Carriage Return + Line Feed — sequence `\r\n` used by Windows and many network protocols as a line terminator. | HTTP headers and CSV on Windows use CRLF line endings. |
| DER | Distinguished Encoding Rules — binary ASN.1 encoding used for certificates/keys. | `.cer/.der` X.509 certs; binary form of ASN.1 structures. |
| EBCDIC | Extended Binary Coded Decimal Interchange Code — 8‑bit character encoding used primarily on IBM mainframes; incompatible with ASCII. | Converting EBCDIC files to ASCII/UTF‑8 when integrating with mainframe systems. |
| GUID | Globally Unique Identifier — Microsoft’s term for UUID. | `{3F25...C3301}` COM-style format. |
| LF | Line Feed — newline control character (0x0A) used by Unix/Linux/macOS to terminate lines. | `\n` in text files; contrast with CR (0x0D) and CRLF (`\r\n`). |
| MIME | Multipurpose Internet Mail Extensions — standardized media types and encoding for content on the internet. | `Content-Type: application/json`; `multipart/form-data` with boundaries. |
| PEM | Privacy-Enhanced Mail — Base64 (PEM) encoding with header/footer lines for certs/keys. | `-----BEGIN CERTIFICATE-----` blocks; `.pem/.crt/.key` files. |
| UCS | Universal Character Set — ISO/IEC 10646 standard defining the full repertoire of Unicode code points; Unicode is kept synchronized with UCS. | UCS-2/UCS-4 historical encodings map to UTF‑16/UTF‑32; code points vs encodings distinction.
| UTF | Unicode Transformation Format — encodings of Unicode code points (e.g., UTF‑8/UTF‑16/UTF‑32). | UTF‑8 is the dominant encoding on the web and in APIs. |
| UUID | Universally Unique Identifier — 128-bit unique ID. | UUID v4 random, v5 namespace. |
| **Legacy** {colspan=3} |
| BCD | Binary-Coded Decimal — encoding that represents each decimal digit with its own binary nibble (4 bits), enabling precise decimal arithmetic. | Packed BCD in financial systems; CPU decimal adjust instructions (DAA/DAS). |
| MBCS | Multi-Byte Character Set — legacy variable-length encodings that use one or more bytes per character (often DBCS for CJK) prior to widespread Unicode adoption. | Windows "ANSI" code pages (Shift_JIS, EUC‑JP); prefer UTF‑8 today.
| **Historical** {colspan=3} |
| CR | Carriage Return — control character (0x0D) historically used to move the print head to column 0; used by classic Mac OS as line terminator. | `\r` in classic Mac text files; pairs with LF in CRLF on Windows. |

## Data Formats (Interchange)

| Acronym | Meaning | Example |
| --- | --- | --- |
| BSON | Binary JSON — binary serialization format with typed fields and efficient encoding designed for fast traversal and in-place updates. | MongoDB wire/storage format; supports types like ObjectId, Date, binary; drivers encode/decode BSON.
| CBOR | Concise Binary Object Representation — compact, schema-optional binary data format designed for small code and message size (RFC 8949). | IoT/API payloads with maps/arrays; COSE for CBOR Object Signing and Encryption; diagnostic notation for debugging. |
| CSV | Comma-Separated Values — plain text tabular format. | `users.csv` exports/imports. |
| HDF5 | Hierarchical Data Format version 5 — portable file format and library for storing large, complex, heterogeneous scientific data with groups/datasets and rich metadata. | Store arrays/tables/images with chunking/compression; used in scientific computing and ML datasets. |
| JSON | JavaScript Object Notation — data format. | `{ "id": 1 }` payloads. |
| JSON-LD | JSON for Linking Data — JSON‑based serialization for Linked Data/RDF that uses `@context` to map terms to IRIs and add semantics to JSON documents. | Embed schema.org with `<script type="application/ld+json">` on web pages; exchange RDF graphs in JSON for knowledge graphs/APIs. |
| JSONL | JSON Lines — newline‑delimited JSON records for streaming/append‑friendly logs and datasets (aka NDJSON). | One JSON object per line; easy to process with line‑oriented tools. |
| netCDF | Network Common Data Form — self‑describing, portable data formats and libraries for array‑oriented scientific data; supports classic (CDF), 64‑bit offset, and netCDF‑4/HDF5. | Earth science datasets (grids/time series); interoperable with many scientific tools.
| ORC | Optimized Row Columnar — columnar storage format optimized for analytics with predicate pushdown, compression, and statistics. | Store big data tables in ORC on Hadoop/Spark; efficient scans and compression.
| RDF | Resource Description Framework — W3C model for describing and linking data using triples (subject–predicate–object), often serialized as Turtle/RDF/XML/JSON‑LD. | Knowledge graphs, linked data; schema.org markup via JSON‑LD.
| TSV | Tab-Separated Values — plain text tabular format using tabs as delimiters. | `users.tsv` exports with tab‑delimited fields. |
| **Legacy** {colspan=3} |
| JSONP | JSON with Padding — legacy technique to circumvent same‑origin policy by wrapping JSON in a callback for script tags. | `callback({ ... })` responses consumed via `<script>`; replaced by CORS. |
| RSS | Really Simple Syndication — XML-based web feed format for publishing updates. | Blog feed at `/feed.xml`; subscribe in a feed reader. |

## Data Formats (Compression & Archival)

| Acronym | Meaning | Example |
| --- | --- | --- |
| 7z | 7‑Zip archive format — open archive container supporting solid compression, advanced filters, and high ratios via LZMA/LZMA2 and others. | Create/extract with `7z a archive.7z files/` and `7z x`; widely used for high‑ratio packaging.
| BZIP2 | Burrows–Wheeler block-sorting compressor — high compression ratio with moderate CPU cost; slower than gzip, faster than xz in many cases. | Compress archives/logs: `bzip2 file`, `tar -cjf archive.tar.bz2 dir/`; `.bz2` packages. |
| DEFLATE | Lossless compression format combining LZ77 sliding‑window dictionary with Huffman coding; ubiquitous in ZIP, gzip, and PNG. | Compress HTTP responses (`Content‑Encoding: gzip/deflate`), ZIP entries, and PNG image data.
| GZIP | GNU Zip — widely used lossless compression format using DEFLATE (LZ77+Huffman); good balance of speed and ratio. | Compress streams/files: `gzip file`, `tar -czf archive.tar.gz dir/`; HTTP `Content-Encoding: gzip`. |
| JAR | Java ARchive — ZIP‑based archive format for packaging Java classes/resources and metadata (`META-INF/MANIFEST.MF`); supports signing and class‑path entries. | Build/run `.jar` apps (`jar cfm app.jar MANIFEST.MF -C out/ .`); libraries on the classpath; fat/uber JARs bundle deps.
| LZ4 | Extremely fast lossless compression algorithm optimized for speed with modest compression ratios. | Compress logs/IPC payloads with LZ4 for low latency; `.lz4` frames. |
| LZ77 | Lempel–Ziv 1977 — dictionary-based lossless compression using a sliding window and back‑references (length, distance) to past data. | Foundation for DEFLATE (gzip/ZIP) and many formats; emits literals and copy tokens.
| LZMA | Lempel–Ziv–Markov chain Algorithm — high‑ratio lossless compression with larger memory use and slower speeds than DEFLATE; foundation for 7z and XZ (LZMA2). | Create 7z archives with LZMA/LZMA2; `xz` uses LZMA2 for `.xz`/`.tar.xz`.
| RAR | Roshal Archive — proprietary archive format supporting solid compression, recovery records, and strong encryption; widely used but not fully open. | Create/extract with WinRAR/`rar`/`unrar`; `.rar` multi‑part volumes; consider 7z/zip for openness.
| RLE | Run-Length Encoding — simple lossless compression that replaces runs of repeated symbols with a count and value. | Bitmap/scanline compression (e.g., BMP RLE, fax/CCITT variants); good for large uniform areas.
| TAR | Tape ARchive — stream/archive format that bundles multiple files/directories with metadata into a single sequential archive; often compressed (e.g., .tar.gz/.tgz). | Create/extract backups: `tar -czf backup.tgz dir/`; used for packaging and distribution.
| XZ | XZ Utils format — high‑ratio lossless compression using LZMA2 with solid archives and strong compression at the cost of CPU/time. | Compress release artifacts/logs: `tar -cJf`, `xz -T0 file`; `.tar.xz` packages in Linux distros.
| ZIP | ZIP archive format — ubiquitous container supporting per‑file compression (typically DEFLATE), random access, and metadata; widely supported on all platforms. | `.zip` files; `zip`/`unzip`; JAR/APK/Office Open XML use ZIP containers. |
| ZSTD | Zstandard — modern fast lossless compression algorithm offering high ratios with very high decompression speed; supports dictionaries. | Compress artifacts/logs with zstd; `.zst` files; use dictionaries for small data.
| **Legacy** {colspan=3} |
| LZW | Lempel–Ziv–Welch — dictionary-based lossless compression algorithm historically used in GIF and some TIFF variants; now patent-free. | Classic GIF image compression; replace with PNG for lossless images.

## Data Processing

| Acronym | Meaning | Example |
| --- | --- | --- |
| ACID | Atomicity, Consistency, Isolation, Durability — transaction guarantees. | Bank transfer completes fully or not at all. |
| BASE | Basically Available, Soft state, Eventual consistency — distributed tradeoff. | Eventual consistency across regions. |
| BI | Business Intelligence — processes/tools to analyze business data for insights and decision‑making. | Dashboards and reports in Looker/Power BI over a warehouse. |
| BLOB | Binary Large Object — large binary field in a DB. | Store images/files as BLOBs or in object storage. |
| CAP | Consistency, Availability, Partition tolerance — favor two under partition. | AP systems may return stale data during splits. |
| CBO | Cost-Based Optimizer — query planner that chooses execution plans by estimating cost using statistics. | Analyze stats; planner picks index scan vs full scan. |
| CDC | Change Data Capture — stream DB changes. | Debezium publishes events to Kafka. |
| CRDT | Conflict-free Replicated Data Type — data structures that merge deterministically without coordination for eventual consistency. | LWW-Element-Set, G-Counter; collaborative docs with Automerge/Yjs. |
| CTE | Common Table Expression — named temporary result set referenced within a statement. | `WITH recent AS (SELECT ...) SELECT * FROM recent WHERE ...`. |
| DB | Database — organized data managed by a DBMS. | Postgres/MySQL database with tables, indexes, and transactions. |
| DBMS | Database Management System — software that manages databases, provides storage, query, and transaction processing. | PostgreSQL, MySQL, SQLite, Oracle, SQL Server. |
| DDL | Data Definition Language — SQL for defining/modifying schema objects. | `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`. |
| DLQ | Dead Letter Queue — holding queue/topic for messages/events that could not be processed or delivered after retries, isolating poison messages for inspection and remediation. | SQS redrive policy sends failed messages to a DLQ; Kafka error/"-dlq" topic. |
| DML | Data Manipulation Language — SQL for querying and changing data. | `SELECT`, `INSERT`, `UPDATE`, `DELETE`. |
| DW | Data Warehouse — centralized, integrated repository optimized for analytics. | Snowflake/BigQuery/Redshift with star/snowflake schemas. |
| ELT | Extract, Load, Transform — load raw data then transform in the warehouse. | Modern ELT with dbt/BigQuery. |
| ETL | Extract, Transform, Load — data integration pipeline. | Batch load to data warehouse. |
| FK | Foreign Key — constraint that enforces referential integrity by requiring values to exist in a referenced table. | `orders.user_id` references `users.id`; ON DELETE CASCADE. |
| HLL | HyperLogLog — probabilistic algorithm for cardinality (distinct count) estimation that uses fixed, small memory with tunable relative error via stochastic averaging of leading-zero counts. | Approximate unique users/events with ~1–2% error using kilobytes of memory; streaming distinct counts in analytics pipelines. |
| LSMT | Log-Structured Merge-Tree — write-optimized indexing/storage structure that buffers writes in memory and flushes them as sorted runs (SSTables) to disk, with background compaction/merging; lowers random writes at the cost of read/space amplification. | Used by LevelDB/RocksDB; LSM-based stores like Cassandra and HBase. |
| MVCC | Multi-Version Concurrency Control — concurrency control that lets readers and writers proceed by keeping multiple row versions and using snapshot visibility rules. | PostgreSQL snapshot reads; VACUUM removes obsolete versions. |
| MQ | Message Queue — durable, asynchronous messaging channel that buffers messages between producers and consumers to decouple services and smooth load. | RabbitMQ/SQS enqueue events; workers consume from the queue to process jobs off the critical path. |
| NoSQL | Non-relational DBs: documents, key-values, graphs, wide columns. | MongoDB, Redis, Cassandra. |
| OLAP | Online Analytical Processing — read-heavy analytics. | BI cubes, columnar stores. |
| OLTP | Online Transaction Processing — write-heavy transactions. | Order processing systems. |
| PK | Primary Key — unique, non-null identifier for a table row. | `users(id UUID PRIMARY KEY)`; composite keys across columns. |
| RDBMS | Relational Database Management System — DBMS based on the relational model using tables, rows, and SQL with constraints and ACID transactions. | PostgreSQL, MySQL, SQL Server, Oracle; normalized schemas and joins. |
| RDD | Resilient Distributed Dataset — fault-tolerant distributed collection in Apache Spark enabling parallel transformations across partitions with lineage-based recovery. | Spark job transforms an RDD with `rdd.map()`/`filter()` and caches it via `persist()` for reuse. |
| SQL | Structured Query Language — query/manage relational DBs. | `SELECT * FROM users`. |
| WAL | Write-Ahead Logging — durability mechanism that writes log records before data pages. | PostgreSQL WAL for crash recovery and replication. |

## Artificial Intelligence

| Acronym | Meaning | Example |
| --- | --- | --- |
| AI | Artificial Intelligence — techniques that enable machines to perform tasks associated with human intelligence (learning, perception, reasoning). | Use ML/DL models to power AI features like recommendations. |
| ANN | Artificial Neural Network — computational model inspired by biological neurons, used for function approximation and pattern recognition. | MLPs for tabular data; feedforward nets for classification. |
| CNN | Convolutional Neural Network — neural network architecture specialized for grid‑like data using convolutional filters. | Image classification/segmentation models. |
| CoT | Chain-of-Thought — prompting technique to elicit step-by-step reasoning. | "Let's think step by step" to improve math/logic. |
| GPT | Generative Pre-trained Transformer — transformer-based LLM architecture pre-trained on large text corpora and fine-tuned for tasks. | GPT-4 class models for chat, code, and reasoning. |
| LLM | Large Language Model — NLP model for generation/reasoning. | GPT/Llama used via APIs or locally. |
| MCP | Model Context Protocol — open protocol to expose tools/data to LLM clients via standardized servers. | Run an MCP server to provide DB/filesystem tools to an LLM client. |
| MoE | Mixture of Experts — sparse expert routing to scale parameters with near-constant compute. | Router selects top‑k experts per token (Switch-Transformer). |
| NER | Named Entity Recognition — extract and label entities in text. | Tag PERSON/ORG/LOC from documents. |
| NLP | Natural Language Processing — techniques for understanding and generating human language. | Text classification, NER, summarization, translation. |
| OCR | Optical Character Recognition — convert images/scans of text into machine‑encoded text using computer vision and sequence models. | Tesseract or deep‑learning OCR to extract text from documents/receipts. |
| RAG | Retrieval-Augmented Generation — ground model outputs by retrieving external knowledge at query time. | Retrieve top‑k docs from a vector store and include them in the prompt. |
| RL | Reinforcement Learning — learning by interaction with an environment via rewards. | Q‑learning, policy gradients; RLHF for model alignment. |
| RLHF | Reinforcement Learning from Human Feedback — align models using human preference signals via a learned reward model. | Collect preference pairs, train a reward model, then fine‑tune with PPO. |
| RNN | Recurrent Neural Network — sequence model with recurrent connections. | LSTM/GRU for language modeling and time series. |
| SFT | Supervised Fine-Tuning — fine‑tune a pretrained model on labeled input–output pairs to specialize behavior. | Fine‑tune a base LLM on instruction datasets before RLHF. |
| TTS | Text-to-Speech — synthesize speech audio from text. | Generate spoken responses from a chatbot. |
| VLM | Vision-Language Model — jointly processes images and text. | CLIP, BLIP, LLaVA for captioning and VQA. |

## Reliability & Operations

| Acronym | Meaning | Example |
| --- | --- | --- |
| DR | Disaster Recovery — restore service after catastrophic failure. | DR runbooks; backup restore drills. |
| HA | High Availability — design to minimize downtime. | Multi-zone deployment with failover. |
| MTTR | Mean Time To Repair/Recover — restore time after failure. | Track MTTR per incident. |
| RCA | Root Cause Analysis — identify underlying cause. | Postmortem documents. |
| RPO | Recovery Point Objective — max acceptable data loss. | 5-minute RPO via frequent backups. |
| RTO | Recovery Time Objective — target restore time. | 30-minute RTO for tier-1 services. |
| SLA | Service Level Agreement — contractual target. | 99.9% monthly uptime. |
| SLI | Service Level Indicator — measured metric. | Request success rate, p95 latency. |
| SLO | Service Level Objective — internal target. | 99.95% quarterly availability. |
| SPOF | Single Point Of Failure — outage if it fails. | Single DB primary without replica. |
| SRE | Site Reliability Engineering — SWE meets ops. | Error budgets, toil reduction. |

## Performance & Metrics

| Acronym | Meaning | Example |
| --- | --- | --- |
| Apdex | Application Performance Index — satisfaction score based on latency thresholds. | Apdex ≥ 0.9 target. |
| APM | Application Performance Monitoring — traces/metrics/errors for apps. | Distributed tracing spans across services. |
| CLS | Cumulative Layout Shift — visual stability (Web Vitals). | CLS < 0.1. |
| FLOPS | Floating-Point Operations Per Second — measure of compute performance for CPUs/GPUs/accelerators. | GPU rated at 30 TFLOPS; benchmark sustained vs peak GFLOPS. |
| FPS | Frames Per Second — render/update frequency for graphics/video; higher is smoother within latency/refresh constraints. | Games target 60+ FPS; VR aims for 90–120 FPS. |
| INP | Interaction to Next Paint — user input responsiveness (Web Vitals). | INP < 200 ms. |
| IOPS | Input/Output Operations Per Second — storage throughput measurement. | NVMe SSD sustaining 500k+ random read IOPS. |
| LCP | Largest Contentful Paint — main content render time (Web Vitals). | LCP < 2.5 s. |
| LoC | Lines of Code — simple size metric counting source lines; can indicate scope but is a poor proxy for complexity or value. | Compare module sizes; avoid using LoC alone for productivity.
| MIPS | Million Instructions Per Second — rough measure of integer instruction throughput; varies widely by ISA and instruction complexity. | Historical CPU comparisons; not comparable across architectures/workloads.
| P50/P95/P99 | Latency percentiles — response time distribution. | P95 latency under 250 ms. |
| RPS/QPS | Requests/Queries Per Second — service throughput. | API serves 2k RPS at peak. |
| RUM | Real User Monitoring — measurements from real users. | In-browser beacons for Web Vitals. |
| TPS | Transactions Per Second — business-level throughput. | Payments at 150 TPS during sale. |
| TTFB | Time To First Byte — time to first response byte. | Aim for TTFB < 200 ms. |
| TTI | Time To Interactive — page becomes reliably usable. | TTI ~ 3.0 s. |

## Networking & Protocols

| Acronym | Meaning | Example |
| --- | --- | --- |
| ARP | Address Resolution Protocol — map IP addresses to MAC addresses on a LAN. | ARP cache; gratuitous ARP. |
| BGP | Border Gateway Protocol — inter-domain routing protocol of the internet. | ISP peering and route advertisements. |
| BPF | Berkeley Packet Filter — kernel-level virtual machine for packet filtering/observability (eBPF on modern kernels). | Capture packets with tcpdump; eBPF programs for tracing. |
| CIDR | Classless Inter-Domain Routing — notation for IP prefixes and aggregation. | `10.0.0.0/16` VPC; subnetting `/24`; route summarization. |
| CNAME | Canonical Name — DNS record that aliases one hostname to another. | `www` CNAME to `example.com`; avoid at zone apex without ALIAS/ANAME. |
| DHCP | Dynamic Host Configuration Protocol — automatic IP configuration. | DHCP assigns IP/gateway/DNS. |
| DoH | DNS over HTTPS — perform DNS resolution over HTTPS for privacy/integrity. | `https://dns.google/dns-query` DoH endpoint. |
| FC | Fibre Channel — high‑speed serial transport for storage networking (SANs) with switched fabrics, typically 8/16/32 Gbit/s, carrying SCSI/FCP. | Connect hosts to SAN arrays over FC via HBAs and switches; zoning and LUN masking.
| HTTP | Hypertext Transfer Protocol — web application protocol. | `GET /index.html` over TCP. |
| HTTPS | HTTP over TLS — encrypted HTTP. | Padlock in browsers. |
| ICMP | Internet Control Message Protocol — diagnostics/control. | `ping` uses Echo Request/Reply. |
| IMAP | Internet Message Access Protocol — email retrieval/sync. | Mail clients syncing mailboxes. |
| IP | Internet Protocol — addressing/routing (IPv4/IPv6). | Packet delivery across networks. |
| IPsec | Internet Protocol Security — suite of protocols for authenticating and encrypting IP packets at the network layer (AH/ESP) with key exchange via IKE. | Site-to-site or remote-access VPNs using IKEv2 with ESP in tunnel mode; transport mode for host-to-host.
| iSCSI | Internet Small Computer Systems Interface — block storage protocol that encapsulates SCSI commands over TCP/IP. | Connect initiators to targets on port 3260; boot from SAN; map LUNs over the network. |
| ISP | Internet Service Provider — company that provides internet connectivity and related services. | Residential broadband, business fiber links, and transit. |
| L2TP | Layer 2 Tunneling Protocol — encapsulates PPP frames to create tunnels across IP networks, typically paired with IPsec for encryption/authentication. | Remote-access VPN uses L2TP over IPsec (UDP 1701/500/4500) to tunnel client traffic through a secure gateway. |
| LAN | Local Area Network — network covering a limited geographic area such as a home, office, or campus. | Ethernet/Wi‑Fi LAN with switches and access points. |
| LDAP | Lightweight Directory Access Protocol — protocol for accessing and managing directory services. | Authenticate/lookup users and groups in an LDAP directory. |
| MAC | Media Access Control — data-link sublayer that governs medium access, framing, and addressing on LANs. | Ethernet MAC handles frame delimiting, MAC addressing, and channel access. |
| MPLS | Multiprotocol Label Switching — high-performance packet forwarding that uses short labels to make traffic-engineered L2.5 paths across provider cores. | ISP backbone uses MPLS L3VPNs/TE to steer customer traffic and provide QoS across the WAN. |
| MTU | Maximum Transmission Unit — largest payload size (in bytes) that can be sent in a single layer‑2 frame without fragmentation. | Ethernet MTU 1500; jumbo frames MTU 9000; Path MTU Discovery avoids fragmentation. |
| MX | Mail Exchanger — DNS record that specifies the mail servers responsible for accepting email for a domain, with preferences for priority/failover. | `example.com. MX 10 mail1.example.com.` and `MX 20 mail2.example.com.` as backup. |
| NAT | Network Address Translation — remap private to public addresses. | Home routers performing PAT. |
| NFS | Network File System — distributed file system protocol for sharing files over a network. | Mount remote directories via NFSv3/NFSv4. |
| NS | Name Server — DNS server authoritative for a zone; also the DNS record type that delegates to authoritative servers. | `NS` records pointing to `ns1.example.com` for a domain. |
| NTP | Network Time Protocol — synchronize clocks over networks using a hierarchy of time sources. | `chrony`/`ntpd` syncing to NTP servers (stratum levels). |
| OSI | Open Systems Interconnection — conceptual seven‑layer networking reference model for describing protocols and interoperability (Layers 1–7: Physical→Application). | Map protocols to layers (e.g., Ethernet=L2, IP=L3, TCP=L4, HTTP=L7); teaching/troubleshooting taxonomy. |
| OSPF | Open Shortest Path First — interior gateway routing protocol. | Multi-area OSPF in enterprises. |
| P2P | Peer-to-Peer — decentralized communication model where nodes act as both clients and servers without a central coordinator. | BitTorrent swarms; WebRTC data channels; DHT-based peer discovery. |
| QoS | Quality of Service — mechanisms that classify and prioritize traffic to meet latency, jitter, and loss requirements. | Configure DiffServ/DSCP queues on routers to give voice and video higher priority than bulk data. |
| QUIC | Quick UDP Internet Connections — encrypted, multiplexed transport over UDP. | HTTP/3 runs over QUIC. |
| SFTP | SSH File Transfer Protocol — file transfer over SSH. | `sftp user@host` uploads/downloads. |
| SMB | Server Message Block — network file/printer sharing protocol used mainly by Windows; modern versions (SMBv2/v3) support signing/encryption. | Mount `\\server\share`; Samba on Unix; avoid SMBv1 due to security issues. |
| SNMP | Simple Network Management Protocol — protocol for monitoring and managing networked devices via a hierarchical MIB of OIDs, supporting polling and asynchronous traps/informs. | Poll interfaces/CPU via GET/GETNEXT/GETBULK; receive traps; v1/v2c (community) and v3 (auth/privacy). |
| SMTP | Simple Mail Transfer Protocol — send email. | MTA relaying messages. |
| SSE | Server-Sent Events — HTTP-based server→client stream. | `EventSource('/events')`. |
| TCP | Transmission Control Protocol — reliable byte stream. | HTTP, TLS use TCP. |
| TCP/IP | Transmission Control Protocol / Internet Protocol — foundational internet protocol suite encompassing transport, network, and related layers. | Classic network stack model; "TCP/IP networking" on UNIX systems. |
| TLD | Top-Level Domain — the highest level in the DNS hierarchy, forming the rightmost label of a domain name. | `.com`, `.org`, country-code TLDs like `.uk`; ICANN-managed root zone. |
| TTL | Time To Live — lifetime for packets/cached records. | DNS TTL controls cache duration. |
| UDP | User Datagram Protocol — connectionless, low-latency. | DNS, streaming. |
| UNC | Universal Naming Convention — Windows network path notation for accessing resources by server/share. | `\\\\server\\share\\folder\\file.txt`; used with SMB. |
| UPnP | Universal Plug and Play — discovery and control protocols for devices/services on a local network; includes IGD for NAT port mappings. | Home routers auto‑open ports via UPnP IGD; device discovery/control on LANs. |
| VLAN | Virtual Local Area Network — Layer 2 network segmentation on a switch, isolating broadcast domains; tagging via IEEE 802.1Q. | VLAN 10/20 on access/trunk ports; tagged vs untagged frames. |
| WAN | Wide Area Network — network spanning large geographic areas interconnecting LANs over provider links or the public internet. | MPLS links, SD‑WAN, site‑to‑site VPN between offices. |
| WHOIS | WHOIS protocol — query/response protocol for retrieving registration information about internet resources such as domain names and IP address allocations. | `whois example.com` to get registrar/registrant data; RDAP is the modern HTTP-based successor.
| WS | WebSocket — full-duplex over single TCP connection. | `ws://example.com/socket`. |
| WSS | WebSocket Secure — WebSocket over TLS. | `wss://example.com/socket`. |
| **Legacy** {colspan=3} |
| FTP | File Transfer Protocol — legacy, unencrypted by default. | `ftp` client for file transfers. |
| FTPS | FTP over TLS — encrypted FTP. | Implicit/explicit FTPS modes. |
| iPXE | Open-source network boot firmware/bootloader extending PXE with HTTP(S), iSCSI, FCoE, AoE, scripts, and TLS. | Chainload iPXE via PXE; fetch an HTTPS boot script to load kernel/initrd.
| IRC | Internet Relay Chat — real-time text messaging protocol and networks for group channels and direct messages. | Join #project on Libera Chat using irssi or WeeChat. |
| NNTP | Network News Transfer Protocol — application protocol for distributing, querying, and posting Usenet articles over TCP. | Connect to Usenet servers on 119 (or 563 for NNTPS) to read/post news.
| POP3 | Post Office Protocol v3 — simple email retrieval. | Fetch-and-delete mailbox flow. |
| PPP | Point-to-Point Protocol — data link layer protocol for encapsulating network traffic over serial links; supports authentication, compression, and multilink. | Dial-up links; PPPoE for broadband; CHAP/PAP authentication. |
| PPTP | Point-to-Point Tunneling Protocol — legacy VPN tunneling protocol that encapsulates PPP over GRE with MPPE encryption; considered insecure and deprecated. | Historical Windows VPNs using PPTP; replace with IPsec/OpenVPN/WireGuard/L2TP over IPsec. |
| PXE | Preboot Execution Environment — standard for network booting clients using DHCP/BOOTP to obtain boot info and TFTP/HTTP to fetch boot loaders/images. | PXE boot a workstation from a provisioning server into an installer.
| RIP | Routing Information Protocol — distance-vector interior gateway protocol using hop count as its metric with periodic full-table updates. | RIP v2 on small LANs; max 15 hops; split horizon/poison reverse to mitigate loops. |
| RLOGIN | Remote Login — BSD plaintext remote login protocol; superseded by SSH. | `rlogin host` for interactive sessions on legacy UNIX systems. |
| RSH | Remote Shell — BSD plaintext remote command execution; superseded by SSH. | `rsh host command` on legacy UNIX; avoid due to lack of security. |
| TFTP | Trivial File Transfer Protocol — simple UDP-based file transfer protocol commonly used for network boot and configuration. | PXE firmware downloads boot images via TFTP; no auth/encryption. |
| **Historical** {colspan=3} |
| ARPANET | Advanced Research Projects Agency Network — pioneering packet‑switched network and direct precursor to the modern Internet. | 1969 UCLA–SRI link; IMPs; 1983 cutover from NCP to TCP/IP. |
| BBS | Bulletin Board System — pre‑web dial‑up systems. | Modem dial‑ins for forums/files before the web. |
| BOOTP | Bootstrap Protocol — assigns IP configuration to diskless clients at boot, predecessor to DHCP. | Network boot ROM requests IP/gateway/TFTP server; largely replaced by DHCP. |
| DECnet | Digital Equipment Corporation's proprietary network protocol suite for DEC systems; largely superseded by TCP/IP. | VAX/VMS clusters and DEC systems communicating over DECnet Phase IV/V. |
| IPX | Internetwork Packet Exchange — Novell's network-layer protocol used with SPX and NetWare; replaced by IP in modern networks. | Legacy NetWare LANs using IPX addressing and routing. |
| ISDN | Integrated Services Digital Network — circuit‑switched digital telephony offering voice and data over PSTN with separate bearer/signaling channels. | BRI (2B+D) for small sites; PRI (23B+D NA / 30B+D EU) for trunks. |
| NCP | NetWare Core Protocol — Novell NetWare file/print service protocol suite running over IPX/SPX (later IP). | Legacy NetWare clients mapping drives/printers via NCP.
| NCP | Network Control Program — early ARPANET host protocol providing a transport layer and flow control prior to the adoption of TCP/IP. | Used until the 1983 flag day cutover to TCP/IP; sockets over NCP.
| NDS | Novell Directory Services — directory service for managing identities, resources, and access in Novell NetWare environments (later evolved into eDirectory). | Centralized users/groups/policies across NetWare; replaced/renamed as eDirectory.
| PUP | PARC Universal Packet — early internetworking protocol suite developed at Xerox PARC that influenced XNS and later networking concepts. | Historical LAN internetworking; precursor to concepts adopted in later stacks.
| RARP | Reverse Address Resolution Protocol — legacy protocol for discovering an IP address given a MAC address. | Early diskless boot; superseded by BOOTP/DHCP. |
| SLIP | Serial Line Internet Protocol — simple encapsulation of IP over serial links; lacks features like authentication, negotiation, and error detection. | Early dial-up IP connectivity; superseded by PPP. |
| SNA | Systems Network Architecture — IBM's proprietary networking architecture for mainframes and enterprise networks; largely superseded by TCP/IP. | IBM 3270/5250 terminals and LU types; later SNA over IP via Enterprise Extender. |
| SPX | Sequenced Packet Exchange — Novell's transport-layer protocol running over IPX, analogous to TCP; superseded by TCP/IP. | NetWare clients/servers using IPX/SPX for file/print services. |
| UUCP | Unix-to-Unix Copy Protocol — store-and-forward system for transferring files, email, and netnews over dial-up/serial links; pre-internet era networking. | Early email/news via bang paths (uucp!host!user); largely replaced by SMTP/NNTP over IP.
| WAIS | Wide Area Information Servers — early distributed document indexing/search and retrieval system predating modern web search; used client/server over Z39.50. | 1990s internet search across WAIS servers before mainstream web engines.
| X.25 | ITU-T legacy packet-switched WAN protocol using virtual circuits over carrier networks; superseded by Frame Relay/ATM/IP. | Early bank/pos/leased-line links using X.25 PADs and PVC/SVC connections. |
| XNS | Xerox Network Systems — Xerox's network protocol suite from PARC that influenced later protocols (e.g., IPX/SPX, AppleTalk). | Historical LAN stack alongside SNA/DECnet; precursor ideas to modern networking.

## Security

| Acronym | Meaning | Example |
| --- | --- | --- |
| 2FA | Two-Factor Authentication — two independent proofs of identity. | Password + TOTP device. |
| ABAC | Attribute-Based Access Control — attribute-driven permissions. | Policies on user/resource attributes. |
| ACL | Access Control List — list of permissions attached to an object specifying which principals are allowed which operations. | Filesystem/network ACLs granting read/write/execute or allow/deny rules. |
| AES | Advanced Encryption Standard — widely used symmetric block cipher (Rijndael) with 128‑bit blocks and 128/192/256‑bit keys. | AES‑GCM for TLS and at‑rest encryption. |
| BYOD | Bring Your Own Device — policy allowing use of personal devices for work, requiring security controls and management. | Enforce MDM, device compliance, and conditional access for email/apps. |
| BYOK | Bring Your Own Key — customer-managed encryption keys used with a cloud provider’s services instead of provider‑managed keys. | Store CMKs in KMS/HSM; configure services to use them; rotate regularly. |
| CA | Certificate Authority — issues digital certificates (X.509). | Let's Encrypt TLS certs. |
| CFI | Control-Flow Integrity — restricts indirect branches/returns to valid targets to thwart code‑reuse attacks (ROP/JOP). | LLVM/Clang CFI, Intel CET/IBT, ARM Pointer Authentication (PAC) harden control flow. |
| CORS | Cross-Origin Resource Sharing — control cross-site requests. | Allow specific origins/headers. |
| CSP | Content Security Policy — control resource loading; mitigate XSS. | `default-src 'self'`. |
| CSRF | Cross-Site Request Forgery — unintended actions by a victim. | CSRF tokens, same-site cookies. |
| CVE | Common Vulnerabilities and Exposures — public identifier for disclosed security issues. | CVE-2024-XXXXX referenced in advisories and patches. |
| DAST | Dynamic App Security Testing — test running apps. | Zap/Burp scans. |
| DDoS | Distributed Denial of Service — many-source DoS. | Botnet floods traffic. |
| DKIM | DomainKeys Identified Mail — cryptographic email authentication using domain-signed headers. | Receivers verify DKIM-Signature with the sender's DNS key. |
| DMARC | Domain-based Message Authentication, Reporting, and Conformance — email authentication policy leveraging SPF and DKIM with alignment and reporting. | Publish `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com`. |
| DoS | Denial of Service — make a service unavailable. | Single-source flood. |
| DRM | Digital Rights Management — technologies to control access, copying, and usage of digital content via encryption and licensing. | Browser EME with Widevine/PlayReady; app checks license server before playback. |
| GPG | GNU Privacy Guard — OpenPGP implementation. | `gpg --sign --encrypt file`. |
| HMAC | Hash-based Message Authentication Code — keyed hash for message integrity and authenticity. | HMAC‑SHA256 for API request signing; JWT HS256. |
| HSM | Hardware Security Module — tamper‑resistant hardware appliance or cloud service for secure key generation, storage, and cryptographic operations with strong access controls and auditing. | Use an HSM/KMS to generate and store TLS/CA private keys; perform signing inside the module. |
| HSTS | HTTP Strict Transport Security — force HTTPS for a period. | `Strict-Transport-Security` header. |
| IAM | Identity and Access Management — users/roles/permissions. | Cloud IAM policies. |
| IDS | Intrusion Detection System — monitors networks/hosts for malicious activity or policy violations, generating alerts for investigation. | Network IDS like Zeek/Snort; host IDS like OSSEC/Wazuh; alert to SIEM.
| IPS | Intrusion Prevention System — inline security control that inspects traffic/events and can automatically block or remediate detected threats. | IPS mode in next‑gen firewalls; Snort/Suricata inline dropping malicious packets.
| JWT | JSON Web Token — compact auth/claims token. | `Authorization: Bearer <jwt>`. |
| MDM | Mobile Device Management — administer and secure mobile/end-user devices via policies, enrollment, and remote actions. | Enforce passcodes, disk encryption, app whitelists; remote wipe on loss. |
| MFA | Multi-Factor Authentication — 2+ factors. | Password + hardware key. |
| MITM | Man-In-The-Middle — intercept/alter comms. | Rogue Wi-Fi AP sniffing. |
| mTLS | Mutual TLS — both client and server present certificates. | Service-to-service auth in meshes. |
| OAuth | Delegated authorization protocol. | Access token for API calls. |
| OIDC | OpenID Connect — identity layer over OAuth 2.0. | ID token for login. |
| OTP | One-Time Password — short‑lived code used for authentication; delivered or generated per login. | App‑generated TOTP/HOTP codes; avoid SMS OTP when possible. |
| PGP | Pretty Good Privacy — encryption/signing format. | Email encryption/signing. |
| PKCS | Public-Key Cryptography Standards — RSA-led standards defining formats and algorithms used in public-key crypto. | PKCS #1 (RSA), #7/CMS (cryptographic messages), #8 (private keys), #12 (PFX/P12), #5 (PBES), #10 (CSR). |
| PKI | Public Key Infrastructure — system of CAs, certs, keys, and policies. | Issue and validate X.509 certs. |
| RBAC | Role-Based Access Control — role-granted permissions. | Admin/Editor/Viewer roles. |
| RCE | Remote Code Execution — run arbitrary code remotely. | Deserialization exploit. |
| RSA | Rivest–Shamir–Adleman — widely used public‑key cryptosystem for encryption and signatures. | 2048‑bit RSA keys; RSA‑PKCS#1 signatures; TLS certs. |
| SAST | Static App Security Testing — analyze code/binaries. | SAST pipeline checks. |
| SBOM | Software Bill of Materials — inventory of components, dependencies, and versions in software artifacts for transparency and vulnerability management. | Generate CycloneDX/SPDX SBOMs in CI; scan against CVEs. |
| SHA | Secure Hash Algorithm — family of cryptographic hash functions (SHA‑2/256/512; SHA‑3/Keccak). | TLS cert signatures, file integrity checks; Git moving from SHA‑1 to SHA‑256. |
| SPF | Sender Policy Framework — DNS-based mechanism to authorize mail servers for a domain. | `v=spf1 ip4:203.0.113.0/24 -all` record. |
| SQLi | SQL Injection — inject SQL via input. | Parameterized queries prevent it. |
| SSH | Secure Shell — encrypted remote login/exec. | `ssh user@host`. |
| SSO | Single Sign-On — authenticate once, access many apps. | SAML/OIDC-based SSO. |
| SSRF | Server-Side Request Forgery — trick server to make requests. | Block metadata endpoints. |
| TLS | Transport Layer Security — secure comms. | HTTPS uses TLS. |
| TOTP | Time-Based One-Time Password — time-synced one-time codes. | Authenticator app 6-digit codes. |
| XSRF | Alternate name for CSRF in some frameworks. | Angular XSRF-TOKEN cookie/header. |
| XSS | Cross-Site Scripting — script injection into pages. | Output encoding, CSP. |
| **Historical** {colspan=3} |
| SSL | Secure Sockets Layer — legacy to TLS. | Deprecated; use TLS. |

## Privacy

| Acronym | Meaning | Example |
| --- | --- | --- |
| CCPA | California Consumer Privacy Act — US privacy law granting rights to access, delete, and opt out of sale of personal data. | Add Do Not Sell link; handle access/deletion requests. |
| CPRA | California Privacy Rights Act — amends/expands CCPA with new rights (correction), sensitive data category, and the CPPA regulator. | Honor opt-out for sharing; handle sensitive PI with limits. |
| DSAR | Data Subject Access Request — request by an individual to access, correct, delete, or obtain a copy of their personal data. | Process access/erasure/portability requests within statutory timelines. |
| GDPR | General Data Protection Regulation — EU law governing personal data protection, rights, and obligations. | Lawful basis, DPO, DPIA; data subject rights (access/erasure/portability). |
| HIPAA | Health Insurance Portability and Accountability Act — US law setting privacy/security standards for protected health information (PHI). | Covered entities sign BAAs; apply the HIPAA Privacy/Security Rules. |
| PII | Personally Identifiable Information — data that can identify an individual; subject to privacy laws and safeguards. | Names, emails, SSNs; apply minimization, masking, and access controls. |

## Infrastructure

| Acronym | Meaning | Example |
| --- | --- | --- |
| AD | Active Directory — Microsoft identity directory service. | Centralized auth/authorization. |
| CDN | Content Delivery Network — globally distributed cache. | Faster static asset delivery. |
| DNS | Domain Name System — resolve names to IPs. | `A`, `AAAA`, `CNAME` records. |
| DNSSEC | Domain Name System Security Extensions — adds origin authentication and data integrity to DNS using digital signatures (RRSIG) validated via a chain of trust from signed zones and DS records. | Sign zones with ZSK/KSK; validators check RRSIGs and DS chain from the root; prevents cache poisoning/spoofing. |
| FaaS | Function as a Service — serverless functions. | AWS Lambda handlers. |
| FQDN | Fully Qualified Domain Name — complete, absolute domain name that specifies all labels up to the root. | `host1.db.eu-west.example.com.` (trailing dot optional in practice). |
| HPC | High-Performance Computing — parallel, large-scale compute using clusters/supercomputers for scientific/engineering workloads. | Run MPI/Slurm jobs on a GPU/CPU cluster with InfiniBand. |
| IaaS | Infrastructure as a Service — virtual compute/storage/network. | EC2/Compute Engine. |
| IaC | Infrastructure as Code — manage infrastructure with code and VCS. | Use Terraform to provision cloud resources via PRs. |
| IoT | Internet of Things — networked embedded devices and sensors that collect data and interact with the physical world. | MQTT devices sending telemetry to an IoT hub. |
| K8S | Kubernetes — container orchestration. | `kubectl get pods`. |
| KMS | Key Management Service — managed key storage and cryptographic operations. | AWS KMS for envelope encryption and key rotation. |
| KVM | Kernel-based Virtual Machine — Linux kernel virtualization enabling VMs with hardware acceleration via KVM modules. | Run QEMU with KVM for near‑native performance; manage with libvirt/virt‑manager. |
| LB | Load Balancer — distributes traffic across multiple backends for scalability and resilience. | AWS ALB/NLB, HAProxy/Nginx with health checks and stickiness. |
| LXC | Linux Containers — OS‑level virtualization using cgroups/namespaces to isolate processes. | Run lightweight containers without a separate kernel per instance. |
| MPI | Message Passing Interface — standardized API for distributed-memory parallel programming using processes that communicate via messages. | Launch ranks with `mpirun` (OpenMPI/MPICH); use collectives like `MPI_Bcast`/`MPI_Reduce`. |
| NAS | Network-Attached Storage — dedicated file storage accessible over a network. | Home/SMB NAS appliances exposing NFS/SMB shares. |
| OCI | Open Container Initiative — specs for container images and runtimes. | OCI Image format and OCI Runtime (runc). |
| PaaS | Platform as a Service — deploy apps without infra mgmt. | Heroku, App Engine. |
| SaaS | Software as a Service — subscription-based software. | Hosted CRM/Email. |
| SAN | Storage Area Network — high-speed network providing block-level storage access to servers. | Fibre Channel/iSCSI SAN for shared volumes. |
| UPS | Uninterruptible Power Supply — device providing battery-backed power to keep equipment running through short outages and allow graceful shutdown. | Rack UPS for servers/network gear; runtime and VA/W ratings.
| VM | Virtual Machine — emulated hardware environment to run OS instances. | KVM/Hyper-V VMs for isolation. |
| VPC | Virtual Private Cloud — isolated virtual network. | Subnets, route tables, SGs. |
| VPN | Virtual Private Network — secure tunnel. | Site-to-site/client VPN. |

## Hardware (Architecture)

| Acronym | Meaning | Example |
| --- | --- | --- |
| AMD64 | 64‑bit x86 architecture introduced by AMD (aka x86‑64, adopted by Intel as Intel 64) extending IA‑32 with 64‑bit registers, more general‑purpose registers, and long mode. | Build for `x86_64`/`amd64`; Linux System V AMD64 ABI; Windows x64 with WOW64 for 32‑bit apps. |
| ARM64 | 64‑bit ARM architecture (aka AArch64, ARMv8‑A and later) with a new instruction set and execution state distinct from 32‑bit ARM (AArch32). | Build for `arm64`/`aarch64`; Apple Silicon Macs, AWS Graviton/Neoverse servers, Android flagship SoCs. |
| CHERI | Capability Hardware Enhanced RISC Instructions — architectural extensions that add tagged, unforgeable capabilities to enforce fine‑grained memory safety and compartmentalization. | CHERI‑RISC‑V/MIPS; pointers carry bounds/permissions; safer C/C++ and sandboxing.
| CISC | Complex Instruction Set Computer — CPU design approach featuring larger, more complex, and variable‑length instructions, often implemented with microcode. | x86/x86‑64 architectures; `REP MOVS`, string ops, rich addressing modes. |
| CUDA | Compute Unified Device Architecture — NVIDIA's parallel computing platform and programming model for GPUs. | Launch kernels in CUDA C++; PyTorch/TensorFlow GPU ops. |
| EM64T | Extended Memory 64 Technology — Intel’s original branding for its AMD64‑compatible 64‑bit x86 implementation, now marketed as Intel 64. | Intel Core/Xeon CPUs report Intel 64; target `x86_64` in toolchains. |
| IA-32 | 32‑bit Intel architecture — the classic 32‑bit x86 ISA (i386 and successors) with protected mode, paging, and SSE-era extensions; predecessor to x86‑64. | Build for `x86`/`i386`/`i686`; 32‑bit OSes/apps, WOW64 on Windows x64, multilib on Linux.
| ISA | Instruction Set Architecture — contract describing a CPU’s instructions, registers, memory model, and privilege levels; distinct from microarchitecture. | x86‑64, ARMv8‑A; RISC‑V RV64GC with optional extensions. |
| MIPS | Microprocessor without Interlocked Pipeline Stages — classic RISC architecture used in embedded systems, networking gear, and historically in workstations/servers. | MIPS32/MIPS64 in routers and embedded devices; historical SGI workstations/IRIX. |
| NUMA | Non-Uniform Memory Access — architecture where memory access latency and bandwidth vary depending on whether memory is local to a CPU socket/node or remote. | Pin threads and allocate memory per NUMA node (e.g., `numactl`) to reduce cross-socket traffic. |
| PA-RISC | Precision Architecture RISC — Hewlett‑Packard’s RISC architecture used in HP 9000 servers/workstations, largely superseded by Itanium and then x86‑64. | HP‑UX on PA‑RISC systems (e.g., PA‑8700/8900); historical HP 9000 platforms. |
| POWER | IBM Performance Optimization With Enhanced RISC — IBM’s RISC architecture family used in servers/workstations (POWER4+), distinct but related to the PowerPC lineage. | IBM Power Systems running AIX/IBM i/Linux; POWER9/POWER10 CPUs. |
| PPC | PowerPC — RISC CPU architecture developed by the AIM alliance (Apple–IBM–Motorola), used in desktops historically and widely in embedded/console systems. | PowerPC 32/64‑bit (POWER/PowerPC); GameCube/Wii/PS3; embedded/controllers.
| RISC | Reduced Instruction Set Computer — CPU design philosophy emphasizing a small, simple instruction set and efficient pipelines. | ARM and RISC-V architectures. |
| RISC-V | Open standard RISC instruction set architecture with modular extensions (e.g., I/M/A/F/D/V) and 32/64/128‑bit variants (RV32/64/128); free to implement without licensing. | Microcontrollers to servers; Linux on RV64GC; chips from SiFive, Andes; SBCs and accelerators.
| SMP | Symmetric Multiprocessing — architecture where multiple identical CPUs/cores share the same memory and OS, enabling parallel execution of threads/processes. | Multi-core x86/ARM systems; OS scheduler runs threads across cores with shared memory. |
| SPARC | Scalable Processor ARChitecture — RISC CPU architecture originally developed by Sun Microsystems, widely used in servers/workstations and embedded systems. | SPARC V8/V9 (32/64‑bit); UltraSPARC/Oracle SPARC running Solaris/illumos. |
| X86-64 | Generic name for the 64‑bit x86 ISA (defined by AMD as AMD64 and implemented by Intel as Intel 64/EM64T); adds 64‑bit mode and more registers over IA‑32. | Build for `x86_64`; 64‑bit OSes and apps on AMD/Intel processors. |
| **Historical** {colspan=3} |
| IA-64 | Intel Itanium architecture — 64‑bit EPIC (Explicitly Parallel Instruction Computing) ISA developed by Intel/HP; distinct from x86/x86‑64 and now discontinued. | Itanium servers/workstations running HP‑UX, OpenVMS, and legacy Windows Server for Itanium‑based systems. |
| PDP | Programmed Data Processor — DEC minicomputer line before VAX. | PDP‑8, PDP‑11 systems. |
| VAX | Virtual Address eXtension — DEC 32‑bit minicomputer architecture. | VAX/VMS systems in universities and industry. |

## Hardware (CPU)

| Acronym | Meaning | Example |
| --- | --- | --- |
| ALU | Arithmetic Logic Unit — digital circuit in the CPU that performs integer arithmetic and bitwise operations. | Add, subtract, AND/OR/XOR, shifts/rotates executed by the ALU pipelines. |
| AMX | Advanced Matrix Extensions — x86 instruction set extensions providing tiled matrix operations accelerated in hardware. | Intel AMX for deep‑learning inference/training (tile registers, TMUL). |
| AP | Application Processor — any non‑bootstrap CPU core in an SMP system that is brought online by the BSP to run the OS scheduler and workloads. | OS sends INIT/SIPI to start APs after BSP init; threads scheduled across APs. |
| APIC | Advanced Programmable Interrupt Controller — modern local/IO APICs providing scalable interrupt delivery in SMP systems. | LAPIC per core and IOAPIC for external IRQs on x86. |
| AVX | Advanced Vector Extensions — x86 SIMD instruction set extensions for wide vector operations (256/512-bit in AVX/AVX-512). | AVX2 for integer ops; AVX-512 for HPC workloads. |
| BSP | Bootstrap Processor — on multi-processor systems (e.g., x86 SMP), the primary CPU core that starts executing firmware/boot code and brings up the OS, which then initializes the remaining cores as Application Processors (APs). | Firmware runs on the BSP first; OS sends INIT/SIPI to start APs. |
| CPU | Central Processing Unit — main processor that executes instructions. | x86-64 CPUs with multiple cores/threads and SIMD. |
| FPU | Floating Point Unit — hardware for floating-point arithmetic. | IEEE 754 operations, SIMD extensions. |
| MMU | Memory Management Unit — hardware for virtual memory and address translation. | x86-64 paging with TLBs. |
| NMI | Non-Maskable Interrupt — high-priority hardware interrupt that cannot be disabled by normal interrupt masking, used for critical fault or watchdog conditions. | Watchdog parity/ECC errors trigger NMI; OS NMI handler logs/diagnoses hangs.
| SIMD | Single Instruction, Multiple Data — vector parallelism executing the same instruction across multiple data lanes. | SSE/AVX on x86, NEON on ARM. |
| SSE | Streaming SIMD Extensions — x86 SIMD instruction set extensions for parallel vector operations. | SSE2/SSE4 intrinsics; compiler autovectorization for math/graphics. |
| TLB | Translation Lookaside Buffer — small cache of virtual→physical address translations used by the MMU. | TLB hits speed up paging; TLB flush on context switch. |
| VMX | Virtual Machine Extensions — Intel x86 virtualization extensions (VT‑x) that add CPU modes/instructions (VMX root/non‑root, VMXON/VMXOFF, VMLAUNCH/VMRESUME) and a VMCS for hardware‑assisted virtualization. | Enable VT‑x in firmware; KVM/Hyper‑V/VMware use VMX to run guests with hardware assist. |
| **Historical** {colspan=3} |
| MMX | MultiMedia eXtensions — early x86 SIMD instruction set for integer vector operations. | Legacy MMX ops predating SSE on Pentium-era CPUs. |

## Hardware (Memory)

| Acronym | Meaning | Example |
| --- | --- | --- |
| DDR | Double Data Rate — class of synchronous DRAM that transfers data on both clock edges for higher bandwidth. | DDR4/DDR5 SDRAM in modern systems. |
| DIMM | Dual Inline Memory Module — standardized memory module form factor for SDRAM. | 288‑pin DDR4/DDR5 DIMMs. |
| DRAM | Dynamic Random Access Memory — volatile memory storing bits in capacitors that require periodic refresh. | Main system memory (SDRAM/DDR). |
| ECC | Error-Correcting Code memory — memory modules/chipsets that detect and correct single‑bit errors (and detect some multi‑bit errors) to improve reliability. | ECC UDIMMs/RDIMMs in servers/workstations; machine check logs corrected errors. |
| EEPROM | Electrically Erasable Programmable Read-Only Memory — non-volatile memory that can be electrically erased and reprogrammed at the byte/page level; used for small configuration storage and microcontroller data. | I²C/SPI EEPROMs (24xx/25xx series); MCU calibration data; distinct from flash (block erase). |
| GDDR | Graphics Double Data Rate — high‑bandwidth memory variants optimized for GPUs and graphics workloads. | GDDR6/GDDR6X on modern GPUs; wide buses and high data rates. |
| HBM | High Bandwidth Memory — stacked memory connected via wide interfaces on‑package for very high bandwidth and energy efficiency. | HBM2/HBM3 on AI/ML accelerators and high‑end GPUs. |
| LPDDR | Low-Power DDR — mobile/embedded DRAM optimized for low power with deep power states and wide IO at low voltage. | LPDDR4/4X/5/5X in smartphones, tablets, ultrabooks, and SoCs. |
| NVRAM | Non-Volatile RAM — memory that retains data without power; implemented via flash, EEPROM, or battery‑backed SRAM; often stores firmware variables/settings. | UEFI variables in NVRAM; macOS NVRAM for boot args and device settings. |
| RAM | Random Access Memory — volatile memory used for working data and code. | DDR4/DDR5 DIMMs. |
| ROM | Read-Only Memory — non-volatile memory storing firmware or static data. | Boot ROM, option ROMs. |
| SDRAM | Synchronous Dynamic Random Access Memory — DRAM synchronized with the system clock, enabling pipelined access and higher throughput versus asynchronous DRAM. | PC100/PC133 SDRAM; basis for modern DDR (DDR/DDR2/3/4/5). |
| SO-DIMM | Small Outline Dual Inline Memory Module — compact memory module form factor used in laptops and small form-factor systems; electrically similar to DIMMs but physically smaller and not interchangeable. | DDR4/DDR5 SO‑DIMMs in laptops/NUCs; shorter modules with different keying. |
| SRAM | Static Random Access Memory — volatile memory using flip-flops; fast and does not need refresh. | CPU caches (L1/L2/L3) implemented with SRAM. |
| **Historical** {colspan=3} |
| EPROM | Erasable Programmable Read-Only Memory — UV-erasable ROM chips with a quartz window; erased under UV light and reprogrammed with a programmer. | 27xx-series EPROMs in retro computers/arcade boards; UV eraser tools. |
| EDO | Extended Data Out DRAM — improved asynchronous DRAM that allows the data output to remain valid longer, enabling slightly higher performance than FPM before SDRAM became mainstream. | Mid‑1990s 486/Pentium systems with EDO SIMMs; replaced by SDRAM. |
| FPM | Fast Page Mode DRAM — asynchronous DRAM access mode that speeds up accesses within the same row/page compared to plain DRAM; predecessor to EDO and SDRAM. | Early 1990s SIMM modules using FPM; superseded by EDO/SDRAM. |
| PROM | Programmable Read-Only Memory — one-time programmable ROM that can be programmed once after manufacturing and cannot be erased. | 82S/27S series PROMs used for microcode/firmware; fuse/antifuse technologies. |
| RDRAM | Rambus DRAM — high‑bandwidth DRAM technology from Rambus used with RIMM modules and a packetized, narrow bus; briefly mainstream on Pentium 4 before being displaced by DDR SDRAM. | RIMM modules in Intel i850/i850E chipsets; now obsolete in favor of DDR/DDR2+. |
| RIMM | Rambus Inline Memory Module — module form factor for RDRAM with continuity requirements (CRIMMs in empty slots) and heat spreaders; used briefly in early‑2000s PCs/servers. | Populate paired RIMMs on i850 boards; install CRIMMs in unused slots; now obsolete.
| SIMM | Single Inline Memory Module — older memory module form factor with a single set of contacts; used with FPM/EDO/early SDRAM. | 30‑pin/72‑pin SIMMs on 386/486/Pentium-era systems. |

## Hardware (Buses & Interfaces)

| Acronym | Meaning | Example |
| --- | --- | --- |
| GPIO | General-Purpose Input/Output — configurable digital pins on microcontrollers/SoCs used for reading inputs and driving outputs; often support pull‑ups/downs and interrupts. | Toggle Raspberry Pi GPIO with `libgpiod`; configure pin mode and edge interrupts. |
| HBA | Host Bus Adapter — adapter that connects a host system to storage or network devices over a high‑speed bus/fabric (e.g., SAS, Fibre Channel). | FC/SAS HBAs in servers to attach SAN/storage arrays; visible via `lspci`. |
| HCI | Host Controller Interface — standardized command/event interface between a host stack and a hardware controller (notably in Bluetooth; also USB xHCI). | Capture Bluetooth HCI packets with `btmon`; interact via UART/USB HCI. |
| MIDI | Musical Instrument Digital Interface — standard protocol/interface for transmitting musical performance data between instruments, controllers, and computers. | 5‑pin DIN or USB‑MIDI; Note On/Off, Control Change; DAW controlling a synth. |
| PCI | Peripheral Component Interconnect — hardware bus standard for attaching peripherals. | PCI devices enumerated by bus/device/function. |
| PCIe | PCI Express — high-speed serial successor to PCI with lanes and links. | x16 GPU slot; NVMe drives over PCIe. |
| PS/2 | Personal System/2 — legacy Mini‑DIN interface for keyboards and mice on PCs. | PS/2 keyboard/mouse ports on motherboards/KVMs; supports NKRO without USB polling.
| SPI | Serial Peripheral Interface — synchronous serial bus with master/slave (controller/peripheral) and separate data lines for full-duplex transfers. | Connect sensors/flash to microcontrollers (MOSI/MISO/SCLK/CS); higher speed than I²C.
| UART | Universal Asynchronous Receiver-Transmitter — hardware for serial communication using asynchronous framing (start/stop bits) over TTL/RS-232 levels. | Debug console on microcontrollers; `/dev/ttyS*`/`/dev/ttyUSB*`; 115200 8N1. |
| USB | Universal Serial Bus — standard for cables and connectors between computers and peripherals. | USB 3.x devices; HID, storage, and serial classes. |
| **Legacy** {colspan=3} |
| COM | Serial COM port — PC designation for RS‑232 serial interfaces (COM1/COM2/...), typically provided by 16550‑class UARTs on DB‑9 connectors. | Connect via null‑modem/USB‑serial; Windows `COM3:`; Linux `/dev/ttyS0` serial consoles. |
| **Historical** {colspan=3} |
| EISA | Extended Industry Standard Architecture — 32‑bit ISA-compatible bus developed by a consortium as an open alternative to MCA; supported bus mastering and IRQ sharing. | Server‑class 486 systems with EISA expansion cards; later replaced by PCI. |
| ISA | Industry Standard Architecture — legacy 8/16‑bit PC expansion bus. | Sound/IO cards on 286/386 era PCs. |
| LPT | Line Printer port — PC parallel printer interface (Centronics/IEEE 1284), addressed as LPT1/LPT2; largely obsolete. | Parallel printers and hardware dongles; DB‑25 connectors; IEEE 1284 SPP/EPP/ECP modes. |
| MCA | Micro Channel Architecture — IBM's proprietary 32‑bit bus introduced with PS/2 systems as a successor to ISA; offered bus mastering and improved throughput but lacked industry adoption. | IBM PS/2 expansion cards; supplanted by EISA/PCI. |
| Q-BUS | DEC Q‑bus — asynchronous multiplexed address/data bus used in later PDP‑11 and early MicroVAX systems; lower-cost successor to Unibus with fewer signals. | Q‑bus backplanes/peripherals in PDP‑11/23 and MicroVAX; legacy DEC minicomputers. |
| Unibus | DEC Unibus — early synchronous shared backplane bus interconnecting CPU, memory, and peripherals in PDP‑11 systems; predecessor to Q‑bus. | PDP‑11 Unibus backplanes/peripherals; historical DEC minicomputers. |
| VLB | VESA Local Bus — high‑speed local bus before PCI. | 486 motherboards with VLB video/IO cards. |
| VME | VMEbus (Versa Module Europa) — parallel backplane bus standard (IEEE 1014) widely used in embedded/industrial systems with Eurocard form factors (3U/6U) and modular CPU/I/O cards. | VME chassis in telecom, industrial control, and defense; CPU cards and I/O modules on a shared backplane. |

## Hardware (Storage)

| Acronym | Meaning | Example |
| --- | --- | --- |
| AHCI | Advanced Host Controller Interface — standard programming interface for SATA host controllers enabling features like NCQ, hot-plug, and native command queuing. | OS uses the AHCI driver; set SATA mode to AHCI in firmware for modern OS installs. |
| GPT | GUID Partition Table — modern disk partitioning scheme that supports large disks and many partitions, part of the UEFI standard. | Disks initialized with GPT instead of legacy MBR. |
| HDD | Hard Disk Drive — magnetic storage device with spinning platters and moving heads. | 3.5"/2.5" SATA HDDs for bulk storage; higher latency than SSDs. |
| LBA | Logical Block Addressing — linear addressing scheme for block devices that replaces legacy CHS (Cylinder/Head/Sector) geometry. | 512‑byte/4K sectors addressed by LBA; used by SATA/SCSI/NVMe.
| LTO | Linear Tape-Open — open tape storage format for data backup/archive with generational roadmap (LTO‑1..LTO‑9), high capacity, and LTFS support. | LTO‑8/LTO‑9 tape drives/libraries in enterprise backups; use LTFS for file‑like access. |
| LUN | Logical Unit Number — identifier addressing a logical unit (virtual disk) within a SCSI/iSCSI/Fibre Channel target, used for mapping storage to hosts. | Present LUNs from a SAN array to servers; host multipath to the same LUN.
| NCQ | Native Command Queuing — SATA feature allowing a drive to accept and reorder multiple outstanding requests to optimize head movement and throughput. | AHCI/SATA HDDs/SSDs improving random I/O by reordering commands. |
| NVMe | Non-Volatile Memory Express — interface protocol for SSDs over PCIe. | M.2 NVMe SSD with high IOPS/low latency. |
| RAID | Redundant Array of Independent Disks — combine multiple drives for redundancy and/or performance. | RAID 1 mirroring; RAID 5 parity; RAID 10 stripe+mirror. |
| SAS | Serial Attached SCSI — point‑to‑point serial interface for enterprise storage. | 12Gb/s SAS HDDs/SSDs; SAS expanders/backplanes. |
| SATA | Serial ATA — interface for connecting storage devices. | 2.5" SATA SSDs and HDDs. |
| SD | Secure Digital — flash memory card format with variants (SD/SDHC/SDXC) commonly used in portable devices; typically formatted with FAT32 or exFAT. | Cameras, handheld consoles, and phones; microSD cards with adapters. |
| SSD | Solid-State Drive — storage device using flash memory (no moving parts), offering low latency and high throughput. | NVMe SSDs for fast boot and build times. |
| **Legacy** {colspan=3} |
| EIDE | Enhanced IDE — extensions to IDE/PATA. | Support for larger drives and ATAPI. |
| IDE/PATA | Integrated Drive Electronics / Parallel ATA — legacy parallel disk interface. | 40/80‑wire ribbon cables for HDD/optical drives. |
| MBR | Master Boot Record — legacy partitioning scheme and first 512 bytes of a disk containing boot code and a partition table. | BIOS boots from MBR; up to 4 primary partitions or extended/logical. |
| UDMA | Ultra Direct Memory Access — ATA/IDE DMA transfer modes providing higher throughput and lower CPU usage than PIO; modes UDMA/33/66/100/133 (higher modes require 80‑wire cables). | PATA drive negotiates UDMA/5 (ATA/100); Linux dmesg shows UDMA/133. |
| WORM | Write Once, Read Many — non‑rewritable archival storage media. | Optical WORM jukeboxes for compliance archives. |
| **Historical** {colspan=3} |
| CHS | Cylinder/Head/Sector — legacy disk geometry addressing scheme used by BIOS/MBR era systems; limited capacity and translation quirks. | 1024‑cylinder limit; CHS/LBA translation in BIOS; superseded by LBA.
| DDS | Digital Data Storage — magnetic tape data storage format derived from DAT (Digital Audio Tape), widely used for backups in the 1990s–2000s (DDS‑1..4, DDS‑DC, DAT72). | DAT/DDS tape drives and media for server/workstation backups; largely obsolete today. |
| DLT | Digital Linear Tape — half‑inch magnetic tape storage format popular in the 1990s–2000s for enterprise backups; superseded by LTO. | DLT/SDLT drives and media in tape libraries; largely obsolete now. |
| FDD | Floppy Disk Drive — magnetic removable storage. | 5.25" and 3.5" floppies. |
| MFM | Modified Frequency Modulation — legacy disk encoding scheme. | Early HDDs and floppies using MFM/RLL. |
| QIC | Quarter-Inch Cartridge — magnetic tape data storage format using 1/4" tape in cartridges; common for backups on PCs/workstations in the 1980s–1990s (e.g., QIC-80/150, Travan). | Tape backup drives and cartridges; largely obsolete today.
| RLL | Run Length Limited — denser successor to MFM for magnetic storage. | RLL controllers for higher HDD capacity. |
| SCSI | Small Computer System Interface — parallel peripheral bus widely used pre‑SATA/USB. | External SCSI disks and scanners on workstations. |

## Hardware (Video & Displays)

| Acronym | Meaning | Example |
| --- | --- | --- |
| DP | DisplayPort — digital display interface with high bandwidth, daisy‑chaining via MST, and adaptive sync support. | DP 1.4/2.0 to high‑refresh monitors; USB‑C DP Alt Mode; MST hub. |
| DPI | Dots Per Inch — measure of print/display resolution; colloquially used for screens though PPI is more precise. | 300‑DPI print quality; “Retina” displays around ~220 PPI. |
| GPU | Graphics Processing Unit — highly parallel processor optimized for graphics and compute. | CUDA/OpenCL workloads; 3D rendering. |
| HDMI | High-Definition Multimedia Interface — digital audio/video interface for connecting sources to displays. | HDMI 2.0/2.1 to monitors/TVs; HDCP for protected content. |
| LCD | Liquid Crystal Display — flat‑panel display technology that uses liquid crystals modulated by a backlight to produce images. | IPS/TN/VA LCD panels; requires LED backlight. |
| LED | Light‑Emitting Diode — semiconductor light source; in monitors/TVs, often shorthand for LED‑backlit LCDs (not emissive per‑pixel). | Status indicator LEDs; LED‑backlit LCD monitors/TVs. |
| HD | High Definition — 720p (1280×720) and 1080i/p (1920×1080) resolution classes. | 1080p monitor; HD streaming. |
| OLED | Organic Light‑Emitting Diode — emissive display technology where each pixel emits light for high contrast and true blacks. | AMOLED smartphone screens; per‑pixel dimming on TVs/phones. |
| PPI | Pixels Per Inch — measure of display pixel density; often confused with DPI which is for print. | 326‑PPI phone display; ~220‑PPI “Retina” laptop panels. |
| QHD | Quad High Definition — 2560×1440 (1440p) resolution at 16:9; roughly 4× 720p and about half the pixels of 4K UHD. | 27" 1440p monitors; competitive gaming displays. |
| RGB | Red, Green, Blue — additive color model used in displays and imaging. | sRGB color space; RGB LED subpixels in LCD/OLED panels. |
| RGBA | Red, Green, Blue, Alpha — RGB color with an additional alpha (opacity) channel for transparency. | CSS `rgba(255, 0, 0, 0.5)`; PNG images with alpha channel.
| UHD | Ultra High Definition — 4K UHD (3840×2160) consumer resolution class; sometimes extends to 8K (7680×4320). | 4K 2160p TV/monitor; UHD streaming. |
| VESA | Video Electronics Standards Association — industry group that defines and maintains display and related interface standards. | DisplayHDR, DP standards, EDID/DMT timing standards. |
| VRAM | Video RAM — memory used by GPUs/display controllers to store framebuffers, textures, and render targets; historically specialized types (e.g., SGRAM, GDDR). | Dedicated GDDR6 on discrete GPUs; shared system memory on iGPUs.
| **Legacy** {colspan=3} |
| SD | Standard Definition — legacy video resolution class around 480i/480p (NTSC) or 576i/576p (PAL), typically 4:3 aspect. | DVD 480p; SDTV broadcast. |
| SVGA | Super VGA — VESA extensions beyond VGA. | 800×600 and higher resolutions. |
| VGA | Video Graphics Array — de facto PC graphics standard. | 640×480 16‑color; mode 13h 320×200×256. |
| **Historical** {colspan=3} |
| AGP | Accelerated Graphics Port — dedicated graphics slot pre‑PCIe. | AGP 4×/8× graphics cards. |
| CGA | Color Graphics Adapter — IBM PC color graphics standard. | 320×200 4‑color modes on early PCs. |
| CRT | Cathode Ray Tube — vacuum tube display technology that steers electron beams across a phosphor‑coated screen to form images. | Legacy CRT monitors/TVs; scanlines, phosphor persistence, high refresh at lower resolutions. |
| EGA | Enhanced Graphics Adapter — improved IBM graphics adapter. | 640×350 16‑color graphics. |

## Hardware (General)

| Acronym | Meaning | Example |
| --- | --- | --- |
| ATX | Advanced Technology eXtended — PC motherboard and power supply form factor standard defining board sizes, mounting, I/O shield, and power connectors. | ATX/mATX/ITX cases; 24‑pin ATX, 8‑pin EPS12V, PCIe 6/8‑pin/12VHPWR.
| CMOS | Complementary Metal‑Oxide‑Semiconductor — low‑power technology used for chips; in PCs, also refers to the small battery‑backed RAM storing firmware settings. | Replace CMOS battery; clear CMOS to reset BIOS/UEFI settings. |
| DMA | Direct Memory Access — device-initiated memory transfers without CPU involvement. | NICs use DMA for packet buffers. |
| FPGA | Field-Programmable Gate Array — reconfigurable semiconductor device consisting of programmable logic blocks and interconnects configured by a bitstream to implement custom digital circuits. | Prototype/accelerate designs; soft CPUs and hardware offload over PCIe; tools like Vivado/Quartus using HDL/RTL. |
| HID | Human Interface Device — USB device class for human input/output peripherals using structured HID reports. | USB keyboards, mice, gamepads; HID report descriptors parsed by OS. |
| IRQ | Interrupt Request — a hardware signal line used by devices to interrupt the CPU for service. | Timer, keyboard, NIC raise IRQs; OS dispatches to ISRs. |
| KVM | Keyboard–Video–Mouse switch — hardware device to control multiple computers with a single keyboard, monitor, and mouse. | Toggle between two PCs with a USB/HDMI KVM switch. |
| MMIO | Memory-Mapped I/O — device registers mapped into the CPU address space for control/status. | Writing to MMIO addresses to control PCIe device registers. |
| NIC | Network Interface Controller — hardware that connects a computer to a network. | Ethernet adapters; 10/25/40/100GbE NICs with offloads. |
| OEM | Original Equipment Manufacturer — company that produces components or products that are marketed by another company; also denotes vendor‑specific builds/licenses. | OEM Windows licenses preinstalled on PCs; OEM parts used by system integrators.
| PC | Personal Computer — general-purpose computer intended for individual use; commonly refers to IBM‑PC compatible systems running Windows/Linux. | Desktop/tower PC with x86‑64 CPU and discrete GPU.
| PnP | Plug and Play — automatic device detection, enumeration, and configuration by the OS/firmware, minimizing manual setup and IRQ/DMA conflicts. | ACPI/PCI PnP; USB devices enumerated and drivers auto‑loaded.
| PSU | Power Supply Unit — converts AC mains to regulated DC rails to power computer components; rated by wattage and efficiency. | ATX PSUs providing +12V/+5V/+3.3V; 80 PLUS efficiency tiers; modular cabling. |
| RTC | Real-Time Clock — hardware clock that keeps time across reboots/power cycles, often backed by a battery. | System reads RTC (CMOS/ACPI) at boot to set the OS clock. |
| SBC | Single-Board Computer — complete computer on a single circuit board integrating CPU, memory, storage, and I/O. | Raspberry Pi, BeagleBone; runs Linux for embedded/edge. |
| SIMT | Single Instruction, Multiple Threads — GPU execution model where groups of threads execute the same instruction on different data. | NVIDIA warp execution; branch divergence reduces efficiency. |
| SMBIOS | System Management BIOS — firmware tables that describe hardware to the OS. | DMI/SMBIOS tables expose model, memory, and slots. |
| SoC | System on Chip — integrated circuit that consolidates CPU cores, GPU, memory controllers, and I/O peripherals on a single die/package. | Smartphone/tablet SoCs (Apple M‑series, Qualcomm Snapdragon); embedded ARM SoCs. |
| TPM | Trusted Platform Module — hardware-based security chip for keys and attestation. | TPM 2.0 used by Secure Boot and disk encryption. |
| **Historical** {colspan=3} |
| PIC | Programmable Interrupt Controller — legacy interrupt controller (e.g., Intel 8259A) that routes hardware IRQs to the CPU. | Classic x86 uses dual 8259 PICs remapped during OS init. |

## Firmware

| Acronym | Meaning | Example |
| --- | --- | --- |
| ACPI | Advanced Configuration and Power Interface — standard for power management and device configuration via tables provided by firmware. | ACPI tables (DSDT/SSDT) describe devices and power states to the OS. |
| SBI | Supervisor Binary Interface — standard interface between a RISC‑V supervisor OS and machine‑mode firmware providing services (timers, IPIs, power, console) via SBI calls; commonly implemented by OpenSBI. | Boot flow: ROM/FSBL → OpenSBI (SBI firmware) → U‑Boot/Linux; OS issues `ecall` to SBI for privileged services. |
| UEFI | Unified Extensible Firmware Interface — modern firmware replacing legacy BIOS with a flexible boot and runtime services model. | UEFI boot managers, GPT disks, Secure Boot. |
| **Legacy** {colspan=3} |
| CSM | Compatibility Support Module — UEFI component that provides legacy BIOS services to boot non‑UEFI OSes and option ROMs; phased out on modern systems. | Enable CSM to boot legacy MBR media or old GPUs with legacy option ROMs. |
| **Historical** {colspan=3} |
| BIOS | Basic Input/Output System — legacy PC firmware that initializes hardware and boots the OS. | PC firmware POST and boot sequence on legacy/CSM systems. |

## Culture & Misc

| Acronym | Meaning | Example |
| --- | --- | --- |
| AFAICT | As Far As I Can Tell — based on current understanding. | “AFAICT, the bug only affects Safari.” |
| AFAIK | As Far As I Know — indicates incomplete knowledge. | “AFAIK, we don't support Windows 7 anymore.” |
| AFK | Away From Keyboard — temporarily unavailable. | “AFK 10 mins, brb.” |
| ASAP | As Soon As Possible — urgent request or prioritization; avoid ambiguity by specifying a concrete timeframe when possible. | “Please review ASAP” → “Please review by EOD.” |
| ATM | At The Moment — current status may change. | “ATM we're blocked on upstream changes.” |
| BDFL | Benevolent Dictator For Life — long-term project leader. | Python’s BDFL history. |
| BOFH | Bastard Operator From Hell — cynical sysadmin trope. | Humor in ops culture. |
| BRB | Be Right Back — brief step away. | “BRB, grabbing coffee.” |
| BTW | By The Way — add side note/context. | “BTW, the API changed in v2.” |
| DM | Direct Message — private one-to-one message in chat/social platforms. | “Send me a DM with the logs.” |
| ELI5 | Explain Like I'm Five — request for simple explanation. | “ELI5 how RSA works.” |
| EOD | End Of Day — end of a working day; common deadline shorthand. | “I'll have a draft ready by EOD.” |
| EOW | End Of Week — end of the current work week; deadline shorthand. | “Targeting EOW for the feature toggle rollout.” |
| EOY | End Of Year — end of the calendar or fiscal year; deadline shorthand. | “Let's target EOY for GA after extended beta.” |
| ETA | Estimated Time of Arrival — expected completion/arrival time. | “ETA for fix is 3pm.” |
| FFS | For F***'s Sake — expression of frustration or exasperation; avoid in formal communication. | “FFS, the build broke again.” |
| FOMO | Fear Of Missing Out — anxiety about missing experiences or opportunities others are having. | “Skip the release party? FOMO is real.” |
| FTW | For The Win — enthusiastic endorsement or celebration of something that worked well. | “Feature flags FTW — painless rollback.” |
| FUD | Fear, Uncertainty, Doubt — disinformation tactic. | Competitor FUD. |
| FWIW | For What It's Worth — modest preface to share input without asserting authority. | “FWIW, retry with exponential backoff.” |
| FYI | For Your Information — share info without requiring action. | “FYI: maintenance window Sunday 2am.” |
| GTK | Good To Know — acknowledges helpful info. | “Rate limit resets hourly — GTK.” |
| HN | Hacker News — tech news and discussion site run by Y Combinator. | Post a launch on news.ycombinator.com; join the discussion. |
| HTH | Hope This Helps — friendly sign‑off when providing assistance or an answer. | “HTH! Ping me if you need more details.” |
| ICYMI | In Case You Missed It — pointer to noteworthy info shared earlier. | “ICYMI, the outage postmortem is posted.” |
| IDK | I Don't Know — lack of information. | “IDK the root cause yet; investigating.” |
| IIRC | If I Recall Correctly — hedged memory. | “IIRC, that was fixed in 1.2.” |
| IIUC | If I Understand Correctly — confirm interpretation. | “IIUC, only a config change is needed.” |
| IMHO | In My Humble Opinion — opinion preface. | “IMHO, we should simplify.” |
| IMO | In My Opinion — opinion preface; a slightly less self-deprecating variant of IMHO. | “IMO, we should ship feature‑flagged.” |
| IRL | In Real Life — referring to the physical/offline world as opposed to online/virtual contexts. | “Let's meet IRL next week.” |
| LGTM | Looks Good To Me — code review approval. | “LGTM, ship it.” |
| LMGTFY | Let Me Google That For You — snarky suggestion to search the web first; use sparingly as it can come across as dismissive. | “LMGTFY: how to clear npm cache.” |
| LMK | Let Me Know — request a follow-up. | “LMK if the deploy finishes.” |
| MOTD | Message Of The Day — login banner/notice. | `/etc/motd` on login. |
| NIH | Not Invented Here — bias to build your own instead of using existing solutions. | Replacing a mature library with custom code. |
| NBD | No Big Deal — indicates something is minor or not worth worrying about. | “Missed the standup — NBD.” |
| NP | No Problem — acknowledgment that a request is fine or a task is acceptable. | “NP, I can take this.” |
| NSFW | Not Safe For Work — content that may be inappropriate for professional settings. | “NSFW: explicit language/images; open privately.” |
| OOO | Out Of Office — unavailable for work/response. | “OOO until Monday.” |
| OP | Original Poster — thread/issue creator. | “Per OP’s repro steps …” |
| OT | Off Topic — content not related to the main subject/thread. | “OT: anyone tried the new keyboard switches?” |
| OTOH | On The Other Hand — introduces a contrasting point or alternative perspective. | “We can optimize now; OTOH, premature optimization adds risk.” |
| PEBKAC | Problem Exists Between Keyboard And Chair — user error. | Misconfigured client settings. |
| PITA | Pain In The Ass — something annoying or cumbersome; avoid in formal communication. | “That migration was a PITA.” |
| PTO | Paid Time Off — time away from work. | “On PTO next week.” |
| QQ | Quick Question — brief, low‑effort question or nudge for a short answer. | “QQ: is staging using the new DB URL?” |
| RIP | Rest In Peace — tongue-in-cheek epitaph for a feature, service, or idea that just failed or was deprecated. | “RIP staging cluster after that migration.” |
| RTFM | Read The F***ing Manual — read docs first. | `git rebase --help`. |
| SME | Subject-Matter Expert — domain expert. | Security SME review. |
| SMH | Shaking My Head — expresses disappointment or disbelief. | “Prod creds in a script? SMH.” |
| SO | Stack Overflow — popular Q&A site for programming and software development. | Link to an accepted SO answer for a solution/workaround. |
| TANSTAAFL | There Ain't No Such Thing As A Free Lunch — highlights that every choice has trade‑offs or hidden costs; nothing is truly free. | “TANSTAAFL: caching speeds reads but adds complexity/invalidation.” |
| TBA | To Be Announced — details later. | Rollout date TBA. |
| TBD | To Be Determined — not finalized. | Owner TBD after planning. |
| TBH | To Be Honest — candid preface. | “TBH, refactor first.” |
| TFA | The F***ing Article — read the article. | TFA explains REST vs RPC. |
| TIA | Thanks In Advance — polite sign‑off indicating appreciation for help to come; consider whether it pressures recipients. | “TIA for reviewing the PR.” |
| TIL | Today I Learned — sharing a new fact or insight just learned. | “TIL `git worktree` simplifies multi-branch checkouts.” |
| TL;DR | Too Long; Didn't Read — summary. | TL;DR: Use approach B. |
| TLA | Three-Letter Acronym — meta-acronym. | “Another TLA.” |
| TTYL | Talk To You Later — casual sign-off indicating you’ll continue the conversation later. | “Gotta run — TTYL.” |
| WCGW | What Could Go Wrong — tongue-in-cheek before risk. | “Deploy Friday, WCGW?” |
| WFH | Work From Home — remote from home. | “WFH today.” |
| WTF | What The F*** — expression of surprise, confusion, or frustration; avoid in formal communication. | “WTF happened to the build pipeline?” |
| YMMV | Your Mileage May Vary — results differ. | Different env outcomes. |
| YOLO | You Only Live Once — humorously justifies taking a risk; use with care. | "YOLO deploy" on Friday — probably don't. |

## Organizations

| Acronym | Meaning | Example |
| --- | --- | --- |
| ACM | Association for Computing Machinery — international learned society for computing, publishing journals, conferences, curricula, and best practices. | ACM SIGs (SIGGRAPH, SIGPLAN), ACM Digital Library, Turing Award. |
| ANSI | American National Standards Institute — U.S. standards organization that oversees and coordinates standards development and accredits standards bodies. | ANSI C (C89/C90) standardization; coordinates U.S. positions in ISO/IEC JTC 1. |
| ASF | Apache Software Foundation — non‑profit that supports Apache open source projects and communities. | Apache HTTP Server, Hadoop, Kafka, Spark under the ASF.
| CNCF | Cloud Native Computing Foundation — part of the Linux Foundation hosting cloud‑native projects and standards. | Kubernetes, Prometheus, Envoy; CNCF landscape and graduation levels.
| ECMA | Ecma International — industry association for information and communication systems standards. | ECMAScript (JavaScript), C# (ECMA-334), CLI (ECMA-335). |
| FSF | Free Software Foundation — GNU/GPL steward. | Publishes GPL family. |
| GNU | GNU’s Not Unix — FSF project and philosophy. | GNU toolchain/userland. |
| IANA | Internet Assigned Numbers Authority — coordinates global IP addressing, DNS root zone management (with ICANN), and protocol parameter registries (ports, DHCP options, etc.). | Port numbers and protocol parameters registries; root zone management with ICANN.
| ICANN | Internet Corporation for Assigned Names and Numbers — oversees the global DNS root, IP address allocation policy coordination, and domain name registries/registrars. | gTLD/ccTLD policies; WHOIS/RDAP; root zone stewardship.
| IEEE | Institute of Electrical and Electronics Engineers — professional association and standards body producing technical standards. | IEEE 802 (Ethernet/Wi‑Fi), IEEE 754 floating‑point. |
| IETF | Internet Engineering Task Force — open standards body that develops and publishes internet standards as RFCs. | HTTP/1.1 (RFC 723x), TLS (RFC 8446), QUIC (RFC 9000); working groups and I-Ds.
| ISO | International Organization for Standardization — independent, non‑governmental international standards body. | ISO 8601 dates/times; ISO/IEC 9899 (C), ISO/IEC 14882 (C++). |
| ITU‑T | International Telecommunication Union — Telecommunication Standardization Sector; develops telecom standards (Recommendations) for networks, media, and services. | ITU‑T H.264/H.265 (with ISO/IEC), G.711/G.722 codecs; numbering, signaling, and transport Recs. |
| NIST | National Institute of Standards and Technology — U.S. federal agency that develops standards, guidelines, and measurements to improve technology, cybersecurity, and commerce. | NIST SP 800‑53/63/171 security guidelines; NIST hash/SHA competition; time services. |
| OASIS | OASIS Open — consortium that develops open standards for security, identity, content, and more. | SAML, STIX/TAXII, KMIP; technical committees and OASIS specifications.
| OMG | Object Management Group — consortium that develops technology standards, notably modeling/specification standards. | UML, CORBA, BPMN standards; working groups and specifications. |
| OSI | Open Source Initiative — OSI-approved licenses. | Open Source Definition stewardship. |
| PCI-SIG | Peripheral Component Interconnect Special Interest Group — consortium that develops and maintains PCI and PCI Express specifications and compliance programs. | PCIe 5.0/6.0 specs, CEM/ECNs; compliance workshops and device interoperability testing.
| SPEC | Standard Performance Evaluation Corporation — develops industry‑standard benchmarks for computing performance and energy. | SPEC CPU, SPECjbb, SPECpower; widely cited performance metrics. |
| TPC | Transaction Processing Performance Council — benchmarks for database and transaction processing systems. | TPC‑C (OLTP), TPC‑H/TPC‑DS (analytics), audited results and full disclosure reports.
| W3C | World Wide Web Consortium — standards body that develops web specifications and recommendations. | HTML/CSS/DOM specs; Working Groups and drafts at w3.org. |
| WHATWG | Web Hypertext Application Technology Working Group — community maintaining living standards for HTML, DOM, and related web platform technologies. | HTML Living Standard; DOM and URL standards co‑developed with browsers.

## Licensing & Open Source

| Acronym | Meaning | Example |
| --- | --- | --- |
| AGPL | GNU Affero GPL — copyleft with network-use clause. | SaaS must release source of modifications. |
| BSD | Berkeley Software Distribution — permissive license family. | BSD-2, BSD-3 clause variants. |
| EULA | End-User License Agreement — contract between software provider and end user defining usage rights/restrictions; common for proprietary software. | Accept EULA during installation; governs redistribution and usage. |
| FLOSS | Free/Libre and Open Source Software — umbrella term. | General discussions of FLOSS. |
| FOSS | Free and Open Source Software — umbrella term. | FOSS projects and communities. |
| GPL | GNU General Public License — strong copyleft. | Derivatives must remain open. |
| LGPL | GNU Lesser GPL — weak copyleft for linking. | Use in libraries linkable from proprietary apps. |
| MIT | MIT License — simple permissive license. | Many JS libs under MIT. |
| OSS | Open Source Software — software under OSI licenses. | OSS adoption. |

</div>
