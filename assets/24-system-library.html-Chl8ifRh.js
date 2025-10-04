import{_ as n,c as a,e,o as i}from"./app-BEnvQN0t.js";const l={};function t(p,s){return i(),a("div",null,[...s[0]||(s[0]=[e(`<h1 id="system-library" tabindex="-1"><a class="header-anchor" href="#system-library"><span>System Library</span></a></h1><p>So far, we have three system calls: <code>print</code>, <code>yield</code>, and <code>exit</code>. It&#39;s going to be tedious to write everything in assembly, so we need to write a system library that wraps these system calls in procs that we can call from our user tasks. This library will be the interface between our user tasks and the kernel.</p><h2 id="writing-the-library" tabindex="-1"><a class="header-anchor" href="#writing-the-library"><span>Writing the Library</span></a></h2><p>Let&#39;s create a new top-level directory called <code>syslib</code>, and inside it, we&#39;ll create two modules for our system calls: <code>io.nim</code> (for <code>print</code>), and <code>os.nim</code> (for <code>yield</code> and <code>exit</code>). Since system call numbers need to be unique, let&#39;s define them in a common module called <code>syscalldef.nim</code>.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/syslib/syscalldef.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">const</span></span>
<span class="line">  SysExit <span class="token operator">=</span> <span class="token number">1</span></span>
<span class="line">  SysPrint <span class="token operator">=</span> <span class="token number">2</span></span>
<span class="line">  SysYield <span class="token operator">=</span> <span class="token number">3</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now let&#39;s add <code>io.nim</code>.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/syslib/io.nim</span></span>
<span class="line"><span class="token keyword">include</span> syscalldef</span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">print<span class="token operator">*</span></span><span class="token punctuation">(</span>pstr<span class="token operator">:</span> <span class="token keyword">ptr</span> string<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">    mov rdi, %0</span>
<span class="line">    mov rsi, %1</span>
<span class="line">    syscall</span>
<span class="line">    :</span>
<span class="line">    : &quot;i&quot; (\`SysPrint\`), &quot;m&quot; (\`pstr\`)</span>
<span class="line">    : &quot;rdi&quot;, &quot;rsi&quot;, &quot;rcx&quot;, &quot;r11&quot;</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This is our first system call wrapper, <code>print</code>. It takes a pointer to a string and passes it to the kernel system call <code>SysPrint</code>.</p><p>Next, let&#39;s add <code>os.nim</code>.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/syslib/os.nim</span></span>
<span class="line"><span class="token keyword">include</span> syscalldef</span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">yld<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">    mov rdi, %0</span>
<span class="line">    syscall</span>
<span class="line">    :</span>
<span class="line">    : &quot;i&quot; (\`SysYield\`)</span>
<span class="line">    : &quot;rdi&quot;, &quot;rcx&quot;, &quot;r11&quot;</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">exit<span class="token operator">*</span></span><span class="token punctuation">(</span>code<span class="token operator">:</span> int<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">    mov rdi, %0</span>
<span class="line">    mov rsi, %1</span>
<span class="line">    syscall</span>
<span class="line">    :</span>
<span class="line">    : &quot;i&quot; (\`SysExit\`), &quot;r&quot; (\`code\`)</span>
<span class="line">    : &quot;rdi&quot;, &quot;rsi&quot;, &quot;rcx&quot;, &quot;r11&quot;</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>These are the wrappers for <code>yield</code> and <code>exit</code>. <code>yield</code> doesn&#39;t take any arguments, so it just passes the system call number to the kernel. <code>exit</code> takes an integer argument, which is the exit code.</p><h2 id="using-the-library" tabindex="-1"><a class="header-anchor" href="#using-the-library"><span>Using the Library</span></a></h2><p>It&#39;s time to put our brand new system library to use. Let&#39;s modify our user task to use all three system calls, instead of the direct system calls we had before.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/user/utask.nim</span></span>
<span class="line"><span class="token keyword">import</span> common<span class="token operator">/</span><span class="token punctuation">[</span>libc<span class="token punctuation">,</span> malloc<span class="token punctuation">]</span></span>
<span class="line highlighted"><span class="token keyword">import</span> syslib<span class="token operator">/</span><span class="token punctuation">[</span>io<span class="token punctuation">,</span> os<span class="token punctuation">]</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">let</span></span>
<span class="line">  msg <span class="token operator">=</span> <span class="token string">&quot;Hello from user mode!&quot;</span></span>
<span class="line">  pmsg <span class="token operator">=</span> msg<span class="token operator">.</span><span class="token keyword">addr</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line highlighted">  <span class="token function">print</span><span class="token punctuation">(</span>pmsg<span class="token punctuation">)</span></span>
<span class="line highlighted">  <span class="token function">yld</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line highlighted">  <span class="token function">exit</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This looks much cleaner and more readable than the assembly code we had before. We can now write our user tasks in Nim, and the system library will take care of the system calls for us.</p><p>Let&#39;s try it out.</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token output">...</span>
<span class="line">kernel: Adding tasks to scheduler</span>
<span class="line">kernel: Starting scheduler</span>
<span class="line">sched: switching -&gt; 0</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 0 -&gt; 1</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 1 -&gt; 2</span>
<span class="line">Hello from user mode!</span>
<span class="line">syscall: yield</span>
<span class="line">sched: switching 2 -&gt; 0</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: switching 0 -&gt; 1</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: switching 1 -&gt; 2</span>
<span class="line">syscall: exit: code=0</span>
<span class="line">sched: no tasks to run, halting</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>No surprises, everything works as expected. We have successfully abstracted the system calls into a library, making it easier to write user tasks without worrying about the details of system calls. We can now add more system calls to the library as we need them.</p><p>In the next few sections I&#39;d like to tackle preemptive multitasking. This will require receiving interrupts from a hardware timer. So far our interrupt support is limited to handling CPU exceptions. For hardware interrupts we need to work with the interrupt controller in our system, which we&#39;ll look at in the next section.</p>`,19)])])}const o=n(l,[["render",t],["__file","24-system-library.html.vue"]]),r=JSON.parse(`{"path":"/osdev/24-system-library.html","title":"System Library","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Writing the Library","slug":"writing-the-library","link":"#writing-the-library","children":[]},{"level":2,"title":"Using the Library","slug":"using-the-library","link":"#using-the-library","children":[]}],"git":{"updatedTime":1744638230000},"filePathRelative":"osdev/24-system-library.md","excerpt":"\\n<p>So far, we have three system calls: <code>print</code>, <code>yield</code>, and <code>exit</code>. It's going to be tedious\\nto write everything in assembly, so we need to write a system library that wraps these\\nsystem calls in procs that we can call from our user tasks. This library will be the\\ninterface between our user tasks and the kernel.</p>"}`);export{o as comp,r as data};
