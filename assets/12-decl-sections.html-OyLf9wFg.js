import{_ as s,c as a,e,o as t}from"./app-0wItSCmZ.js";const l="/assets/decl-section-ByY72AJN.png",p="/assets/var-const-sections-C8vBZBcj.png",i="/assets/psi-no-stmt-CSPMWNgQ.png",o={};function c(r,n){return t(),a("div",null,n[0]||(n[0]=[e(`<h1 id="declaration-sections" tabindex="-1"><a class="header-anchor" href="#declaration-sections"><span>Declaration Sections</span></a></h1><p>In addition to declaring single variables in a declaration statement, Nim also supports declaring multiple variables in the same statement using an indented section. For example:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token keyword">let</span> msg <span class="token operator">=</span> <span class="token string">&quot;hello&quot;</span>   <span class="token comment"># single declaration</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">let</span>                 <span class="token comment"># multiple declarations</span></span>
<span class="line">  foo <span class="token operator">=</span> <span class="token string">&quot;foo&quot;</span></span>
<span class="line">  bar <span class="token operator">=</span> <span class="token string">&quot;bar&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now that we have support for indentation in the grammar, we can easily modify the <code>LetSection</code> rule to support multiple declarations, in addition to the existing single declaration.</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line">// src/main/kotlin/khaledh/nimjet/parser/Nim.bnf</span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">LetSection <span class="token operator">::=</span> LET IdentDef</span>
<span class="line">             <span class="token operator">|</span> LET IND IdentDef <span class="token operator">(</span>EQD IdentDef<span class="token operator">)</span><span class="token operator">*</span> DED</span>
<span class="line"></span>
<span class="line">IdentDef   <span class="token operator">::=</span> IdentDecl EQ STRING_LIT</span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The <code>LetSection</code> rule now has an alternative that allows multiple declarations in an indented section, where declarations in the section are separated by <code>EQD</code>. I factored out a common part of the two alternatives into a separate <code>IdentDef</code> rule to avoid duplication. Let&#39;s test it out.</p><p><img src="`+l+`" alt="Declaration Section" width="600"></p><p>This looks to be correct. The PSI tree shows two <code>IdentDef</code> nodes under the <code>LetSection</code> node. We are already reaping the benefits of the indentation support we added earlier, keeping the grammar clean and easy to read.</p><h2 id="let-var-and-const-sections" tabindex="-1"><a class="header-anchor" href="#let-var-and-const-sections"><span>Let, Var, and Const Sections</span></a></h2><p>Nim has three different kinds of variable declarations: <code>let</code>, <code>var</code>, and <code>const</code>. They all use the same syntax for declaration, but they have different semantics. Let&#39;s add similar support for <code>var</code> and <code>const</code> declarations in the grammar.</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">Stmt         <span class="token operator">::=</span> LetSection</span>
<span class="line highlighted">               <span class="token operator">|</span> VarSection</span>
<span class="line highlighted">               <span class="token operator">|</span> ConstSection</span>
<span class="line">               <span class="token operator">|</span> Command</span>
<span class="line">               <span class="token operator">|</span> BlockStmt</span>
<span class="line"></span>
<span class="line">LetSection   <span class="token operator">::=</span> LET IdentDef</span>
<span class="line">               <span class="token operator">|</span> LET IND IdentDef <span class="token operator">(</span>EQD IdentDef<span class="token operator">)</span><span class="token operator">*</span> DED</span>
<span class="line"></span>
<span class="line highlighted">VarSection   <span class="token operator">::=</span> VAR IdentDef</span>
<span class="line highlighted">               <span class="token operator">|</span> VAR IND IdentDef <span class="token operator">(</span>EQD IdentDef<span class="token operator">)</span><span class="token operator">*</span> DED</span>
<span class="line"></span>
<span class="line highlighted">ConstSection <span class="token operator">::=</span> CONST IdentDef</span>
<span class="line highlighted">               <span class="token operator">|</span> CONST IND IdentDef <span class="token operator">(</span>EQD IdentDef<span class="token operator">)</span><span class="token operator">*</span> DED</span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s not also forget to add the <code>var</code> and <code>const</code> keyword tokens to the lexer and the <code>NimToken</code> class.</p><div class="language-java line-numbers-mode" data-highlighter="prismjs" data-ext="java" data-title="java"><pre><code><span class="line"><span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span></span>
<span class="line"></span>
<span class="line"><span class="token generics"><span class="token punctuation">&lt;</span>YYINITIAL<span class="token punctuation">&gt;</span></span> <span class="token punctuation">{</span></span>
<span class="line">  <span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span></span>
<span class="line"></span>
<span class="line">  <span class="token string">&quot;let&quot;</span>                          <span class="token punctuation">{</span> <span class="token keyword">return</span> <span class="token class-name">NimToken</span><span class="token punctuation">.</span><span class="token constant">LET</span><span class="token punctuation">;</span> <span class="token punctuation">}</span></span>
<span class="line highlighted">  <span class="token string">&quot;var&quot;</span>                          <span class="token punctuation">{</span> <span class="token keyword">return</span> <span class="token class-name">NimToken</span><span class="token punctuation">.</span><span class="token constant">VAR</span><span class="token punctuation">;</span> <span class="token punctuation">}</span></span>
<span class="line highlighted">  <span class="token string">&quot;const&quot;</span>                        <span class="token punctuation">{</span> <span class="token keyword">return</span> <span class="token class-name">NimToken</span><span class="token punctuation">.</span><span class="token constant">CONST</span><span class="token punctuation">;</span> <span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line">  <span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s test the new <code>var</code> and <code>const</code> declarations.</p><p><img src="`+p+`" alt="Var and Const Sections" width="600"></p><p>All seems to be working as expected.</p><h2 id="meta-rules" tabindex="-1"><a class="header-anchor" href="#meta-rules"><span>Meta Rules</span></a></h2><p>The <code>LetSection</code>, <code>VarSection</code>, and <code>ConstSection</code> rules are very similar. They only differ in the keyword token they use. We can factor out the common parts of these rules into a <em>meta rule</em>, which is a Grammar-Kit construct to define a parameterized rule (kind of similar to generics).</p><p>A meta rule doesn&#39;t define explicit parameters. Instead, it uses an implicit parameter <code>&lt;&lt;p&gt;&gt;</code> for rules that use a single parameter, or <code>&lt;&lt;p1&gt;&gt;</code>, <code>&lt;&lt;p2&gt;&gt;</code>, etc., for rules that use multiple parameters. To invoke the meta rule, you use the <code>&lt;&lt;rule_name ...&gt;&gt;</code> syntax, and pass other rules as arguments.</p><p>Let&#39;s define a meta rule for the variable declaration sections.</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line">LetSection           <span class="token operator">::=</span> LET &lt;<span class="token rule"><span class="token punctuation">&lt;</span>section IdentDef<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line">VarSection           <span class="token operator">::=</span> VAR &lt;<span class="token rule"><span class="token punctuation">&lt;</span>section IdentDef<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line">ConstSection         <span class="token operator">::=</span> CONST &lt;<span class="token rule"><span class="token punctuation">&lt;</span>section IdentDef<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line"></span>
<span class="line">private meta section <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line">                       <span class="token operator">|</span> IND &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt; <span class="token operator">(</span>EQD &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt;<span class="token operator">)</span><span class="token operator">*</span> DED</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This is equivalent to the original rules we defined earlier, but with less redundancy.</p><p>Let&#39;s make another use of meta rules. We&#39;ve seen the pattern <code>&lt;&lt;p&gt;&gt; (EQD &lt;&lt;p&gt;&gt;)*</code> before in the <code>StmtList</code> rule:</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line">StmtList   <span class="token operator">::=</span> Stmt <span class="token operator">(</span>EQD Stmt<span class="token operator">)</span><span class="token operator">*</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>This pattern basically defines a sequence of items separated by a delimiter. We can factor this pattern into a meta rule as well, let&#39;s call it <code>list</code>, and use it both in the <code>StmtList</code> rule and the <code>section</code> meta rule (yes, meta rules can be nested).</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line">StmtList             <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>list Stmt EQD<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">private meta list    <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p1<span class="token punctuation">&gt;</span></span>&gt; <span class="token operator">(</span>&lt;<span class="token rule"><span class="token punctuation">&lt;</span>p2<span class="token punctuation">&gt;</span></span>&gt; &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p1<span class="token punctuation">&gt;</span></span>&gt;<span class="token operator">)</span><span class="token operator">*</span></span>
<span class="line">private meta section <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line">                       <span class="token operator">|</span> IND &lt;&lt;list &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt; EQD&gt;&gt; DED</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This time, the <code>list</code> meta rule takes two parameters: <code>&lt;&lt;p1&gt;&gt;</code> and <code>&lt;&lt;p2&gt;&gt;</code>. The first parameter represents the item to be repeated, and the second parameter represents the delimiter. We make use of it in the <code>StmtList</code> rule to define a repeated sequence of <code>Stmt</code> nodes separated by <code>EQD</code>. We also use it in the <code>section</code> meta rule to define a repeated sequence of <code>&lt;&lt;p&gt;&gt;</code> nodes separated by <code>EQD</code>.</p><p>Another pattern we can factor out is the <code>IND ... DED</code> pattern, which defines an indented block of code. Let&#39;s define an <code>indented</code> meta rule for this pattern. We&#39;ll use it in both the <code>BlockStmt</code> rule and the <code>section</code> meta rule.</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line"><span class="token operator">...</span></span>
<span class="line highlighted">BlockStmt  <span class="token operator">::=</span> BLOCK COLON &lt;<span class="token rule"><span class="token punctuation">&lt;</span>indented StmtList<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line"></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line highlighted">private meta indented <span class="token operator">::=</span> IND &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt; DED</span>
<span class="line">private meta section  <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line highlighted">                        <span class="token operator">|</span> &lt;&lt;indented &lt;&lt;list &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt; EQD&gt;&gt;&gt;&gt;</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we test the grammar now, we should see no difference in the behavior, but the grammar is now much more lean and DRY. Here&#39;s the full grammar so far.</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line">Module       <span class="token operator">::=</span> !&lt;<span class="token rule"><span class="token punctuation">&lt;</span>eof<span class="token punctuation">&gt;</span></span>&gt; StmtList</span>
<span class="line"></span>
<span class="line">StmtList     <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>list Stmt EQD<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line"></span>
<span class="line">Stmt         <span class="token operator">::=</span> ConstSection</span>
<span class="line">               <span class="token operator">|</span> VarSection</span>
<span class="line">               <span class="token operator">|</span> LetSection</span>
<span class="line">               <span class="token operator">|</span> Command</span>
<span class="line">               <span class="token operator">|</span> BlockStmt</span>
<span class="line"></span>
<span class="line">ConstSection <span class="token operator">::=</span> CONST &lt;<span class="token rule"><span class="token punctuation">&lt;</span>section IdentDef<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line">LetSection   <span class="token operator">::=</span> LET &lt;<span class="token rule"><span class="token punctuation">&lt;</span>section IdentDef<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line">VarSection   <span class="token operator">::=</span> VAR &lt;<span class="token rule"><span class="token punctuation">&lt;</span>section IdentDef<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line"></span>
<span class="line">IdentDef     <span class="token operator">::=</span> IdentDecl EQ STRING_LIT</span>
<span class="line"></span>
<span class="line">Command      <span class="token operator">::=</span> IdentRef IdentRef</span>
<span class="line"></span>
<span class="line">BlockStmt    <span class="token operator">::=</span> BLOCK COLON &lt;<span class="token rule"><span class="token punctuation">&lt;</span>indented StmtList<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line"></span>
<span class="line">IdentDecl    <span class="token operator">::=</span> IDENT</span>
<span class="line">IdentRef     <span class="token operator">::=</span> IDENT</span>
<span class="line"></span>
<span class="line"></span>
<span class="line">// meta rules</span>
<span class="line"></span>
<span class="line">private meta list     <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p1<span class="token punctuation">&gt;</span></span>&gt; <span class="token operator">(</span>&lt;<span class="token rule"><span class="token punctuation">&lt;</span>p2<span class="token punctuation">&gt;</span></span>&gt; &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p1<span class="token punctuation">&gt;</span></span>&gt;<span class="token operator">)</span><span class="token operator">*</span></span>
<span class="line">private meta indented <span class="token operator">::=</span> IND &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt; DED</span>
<span class="line">private meta section  <span class="token operator">::=</span> &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt;</span>
<span class="line">                        <span class="token operator">|</span> &lt;&lt;indented &lt;&lt;list &lt;<span class="token rule"><span class="token punctuation">&lt;</span>p<span class="token punctuation">&gt;</span></span>&gt; EQD&gt;&gt;&gt;&gt;</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;ll make more use of meta rules in the future when we encounter more patterns that can be factored out.</p><h2 id="psi-cleanup" tabindex="-1"><a class="header-anchor" href="#psi-cleanup"><span>PSI Cleanup</span></a></h2><p>One last thing we can do to clean up the PSI tree a bit is to make the <code>Stmt</code> rule private. This rule doesn&#39;t serve any purpose on its own, other than to group other statement rules. Making it private will make the individual statement rules direct children of the <code>StmtList</code> node in the PSI tree.</p><div class="language-bnf line-numbers-mode" data-highlighter="prismjs" data-ext="bnf" data-title="bnf"><pre><code><span class="line">private Stmt <span class="token operator">::=</span> ConstSection</span>
<span class="line">               <span class="token operator">|</span> <span class="token operator">...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s see what the PSI tree looks like now.</p><p><img src="`+i+'" alt="PSI Tree - No Stmt Nodes" width="600"></p><p>This looks much cleaner. The <code>Stmt</code> nodes are gone, and we can see the declaration sections directly under the <code>StmtList</code> node.</p>',38)]))}const u=s(o,[["render",c],["__file","12-decl-sections.html.vue"]]),m=JSON.parse('{"path":"/nimjet/12-decl-sections.html","title":"Declaration Sections","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Let, Var, and Const Sections","slug":"let-var-and-const-sections","link":"#let-var-and-const-sections","children":[]},{"level":2,"title":"Meta Rules","slug":"meta-rules","link":"#meta-rules","children":[]},{"level":2,"title":"PSI Cleanup","slug":"psi-cleanup","link":"#psi-cleanup","children":[]}],"git":{"updatedTime":1727702303000},"filePathRelative":"nimjet/12-decl-sections.md","excerpt":"\\n<p>In addition to declaring single variables in a declaration statement, Nim also\\nsupports declaring multiple variables in the same statement using an indented section.\\nFor example:</p>\\n<div class=\\"language-nim line-numbers-mode\\" data-highlighter=\\"prismjs\\" data-ext=\\"nim\\" data-title=\\"nim\\"><pre><code><span class=\\"line\\"><span class=\\"token keyword\\">let</span> msg <span class=\\"token operator\\">=</span> <span class=\\"token string\\">\\"hello\\"</span>   <span class=\\"token comment\\"># single declaration</span></span>\\n<span class=\\"line\\"></span>\\n<span class=\\"line\\"><span class=\\"token keyword\\">let</span>                 <span class=\\"token comment\\"># multiple declarations</span></span>\\n<span class=\\"line\\">  foo <span class=\\"token operator\\">=</span> <span class=\\"token string\\">\\"foo\\"</span></span>\\n<span class=\\"line\\">  bar <span class=\\"token operator\\">=</span> <span class=\\"token string\\">\\"bar\\"</span></span>\\n<span class=\\"line\\"></span></code></pre>\\n<div class=\\"line-numbers\\" aria-hidden=\\"true\\" style=\\"counter-reset:line-number 0\\"><div class=\\"line-number\\"></div><div class=\\"line-number\\"></div><div class=\\"line-number\\"></div><div class=\\"line-number\\"></div><div class=\\"line-number\\"></div></div></div>"}');export{u as comp,m as data};
