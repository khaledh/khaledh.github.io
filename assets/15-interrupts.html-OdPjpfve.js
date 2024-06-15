import{_ as n,o as s,c as e,e as a}from"./app-IpIrRMej.js";const t={},i=a(`<h1 id="interrupts" tabindex="-1"><a class="header-anchor" href="#interrupts" aria-hidden="true">#</a> Interrupts</h1><p>When the CPU encounters an error, e.g. a division by zero or a page fault, it will raise an exception, which is a kind of interrupt. The CPU consults a table, called the <strong>Interrupt Descriptor Table</strong> (IDT), to find the address of the exception handler. The IDT is a table of 256 entries, not all of which are used. Each entry contains the address of an interrupt handler, which is a function in the kernel that handles the interrupt. Intel reserves the first 32 entries for CPU exceptions, which is what we&#39;ll focus on in this section. The remaining entries are for hardware or software interrupts, which we&#39;ll cover in a later section.</p><h2 id="interrupt-descriptors" tabindex="-1"><a class="header-anchor" href="#interrupt-descriptors" aria-hidden="true">#</a> Interrupt Descriptors</h2><p>The IDT is an array of 256 entries, each is a 16-byte descriptor (in 64-bit mode). The index (not the offset) of a descriptor in the IDT is called an <strong>interrupt vector</strong>. Each descriptor points to an interrupt handler, which is a function in the kernel that handles that particular interrupt vector. During an interrupt, the interrupt vector is delievered to the CPU, which uses it as an index into the IDT to find the corresponding interrupt handler.</p><p>For example, the interrupt vector for a page fault is 14, so when a page fault occurs, the CPU will look at the 14th entry in the IDT to find the page fault handler. Another example is when a device is configured to use a particular interrupt vector, then when the device raises an interrupt, it places that vector on the bus, and the CPU will use it to find the interrupt handler in the IDT.</p><p>There are three types of descriptors in the IDT: task gates, interrupt gates, and trap gates. Task gates are used for hardware task switching, which is obsolete in 64-bit mode, so we&#39;ll focus only on interrupt gates and trap gates. The difference between the two is that interrupt gates disable interrupts when the handler is running, while trap gates do not.</p><p>Here&#39;s a diagram of interrupt/trap gate descriptors:</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>                                       Interrupt/Trap Gate
 31                                                                                           00
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            Reserved                                           │ 12
└───────────────────────────────────────────────────────────────────────────────────────────────┘
 31                                                                                           00
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        Offset[63:32]                                          │ 8
└───────────────────────────────────────────────────────────────────────────────────────────────┘
 31                                           16 15 14 13 12 11       08 07       04 03 02    00
┌───────────────────────────────────────────────┬──┬─────┬──┬───────────┬────────┬──┬──┬────────┐
│                 Offset[31:16]                 │P │ DPL │ 0│   Type    │0  0  0 │0 │0 │  IST   │ 4
└───────────────────────────────────────────────┴──┴─────┴──┴───────────┴────────┴──┴──┴────────┘
 31                                           16 15                                           00
┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
│               Segment Selector                │                 Offset[15:00]                 │ 0
└───────────────────────────────────────────────┴───────────────────────────────────────────────┘

DPL         Descriptor Privilege Level
Offset      Offset to procedure entry point
P           Segment Present flag
Selector    Segment Selector for destination code segment
IST         Interrupt Stack Table (index into IST in TSS)
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Some notes about the fields:</p><ul><li>The <strong>Segment Selector</strong> field is the segment selector for the destination code segment. Since all interrupt handlers are in the kernel, we&#39;ll set it to the kernel code segment selector.</li><li>The <strong>IST</strong> field has to do with stack switching during an interrupt, which we&#39;ll cover in a later section. For now, we&#39;ll set it to 0.</li><li>The <strong>Type</strong> field determines the type of interrupt gate. In 64-bit mode, there are two types of gates: interrupt gate (Type = <code>0b1110</code>) and trap gate (Type = <code>0b1111</code>).</li><li>The <strong>DPL</strong> field determines the privilege level required to invoke the interrupt handler. It&#39;s checked only if an exception or interrupt is generated with an INT n, INT3, or INTO instruction. This is to prevent user programs from invoking privileged interrupt handlers, so we&#39;ll set it to 0.</li></ul><p>Let&#39;s create a new <code>idt.nim</code> module and define a type for interrupt gates. We&#39;ll also define a type for interrupt handlers, which is a procedure that takes a pointer to the interrupt stack frame as an argument.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>
<span class="token keyword">import</span> gdt

<span class="token keyword">type</span>
  InterruptGate <span class="token punctuation">{.</span>packed<span class="token punctuation">.}</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    offset00<span class="token operator">:</span> uint16
    selector<span class="token operator">:</span> uint16 <span class="token operator">=</span> KernelCodeSegmentSelector
    ist <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">3.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    zero0 <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">5.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    <span class="token identifier"><span class="token punctuation">\`</span>type<span class="token punctuation">\`</span></span> <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">4.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0b1110</span>
    zero1 <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    dpl <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">2.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">0</span>
    present <span class="token punctuation">{.</span>bitsize<span class="token operator">:</span> <span class="token number">1.</span><span class="token punctuation">}</span><span class="token operator">:</span> uint8 <span class="token operator">=</span> <span class="token number">1</span>
    offset16<span class="token operator">:</span> uint16
    offset32<span class="token operator">:</span> uint32
    reserved<span class="token operator">:</span> uint32 <span class="token operator">=</span> <span class="token number">0</span>

  InterruptHandler <span class="token operator">=</span> <span class="token function">proc</span> <span class="token punctuation">(</span>frame<span class="token operator">:</span> pointer<span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s also define a helper function to create a new interrupt gate given an interrupt handler.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>

<span class="token keyword">proc</span> <span class="token function">newInterruptGate</span><span class="token punctuation">(</span>handler<span class="token operator">:</span> InterruptHandler<span class="token punctuation">)</span><span class="token operator">:</span> InterruptGate <span class="token operator">=</span>
  <span class="token keyword">let</span> offset <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>handler<span class="token punctuation">)</span>
  result <span class="token operator">=</span> <span class="token function">InterruptGate</span><span class="token punctuation">(</span>
    offset00<span class="token operator">:</span> <span class="token function">uint16</span><span class="token punctuation">(</span>offset<span class="token punctuation">)</span><span class="token punctuation">,</span>
    offset16<span class="token operator">:</span> <span class="token function">uint16</span><span class="token punctuation">(</span>offset <span class="token operator">shr</span> <span class="token number">16</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    offset32<span class="token operator">:</span> <span class="token function">uint32</span><span class="token punctuation">(</span>offset <span class="token operator">shr</span> <span class="token number">32</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
  <span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we can create the IDT. We&#39;ll use a Nim array to represent the IDT. We&#39;ll also define a type for the IDT descriptor and declare a single instance of it, which we&#39;ll use to load the IDT into the LDTR register later.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>
<span class="token operator">...</span>

<span class="token keyword">type</span>
  InterruptGate <span class="token punctuation">{.</span>packed<span class="token punctuation">.}</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token operator">...</span>

  IdtDescriptor <span class="token punctuation">{.</span>packed<span class="token punctuation">.}</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    limit<span class="token operator">:</span> uint16
    base<span class="token operator">:</span> pointer

<span class="token keyword">var</span>
  idtEntries<span class="token operator">:</span> array<span class="token punctuation">[</span><span class="token number">256</span><span class="token punctuation">,</span> InterruptGate<span class="token punctuation">]</span>

<span class="token keyword">let</span>
  idtDescriptor <span class="token operator">=</span> <span class="token function">IdtDescriptor</span><span class="token punctuation">(</span>
    limit<span class="token operator">:</span> <span class="token function">sizeof</span><span class="token punctuation">(</span>idtEntries<span class="token punctuation">)</span> <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">,</span>
    base<span class="token operator">:</span> idtEntries<span class="token operator">.</span><span class="token keyword">addr</span>
  <span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="defining-interrupt-handlers" tabindex="-1"><a class="header-anchor" href="#defining-interrupt-handlers" aria-hidden="true">#</a> Defining Interrupt Handlers</h2><p>Interrupt procedures are not normal procedures; there&#39;s a catch. When an interrupt handler is called, the CPU pushes some information onto the stack, called the <strong>interrupt stack frame</strong>. The handler must also return using the <code>iretq</code> instruction (as opposed to using <code>ret</code>), which pops the interrupt stack frame and returns to the interrupted program. Here&#39;s a diagram of the interrupt stack frame:</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>      Handler&#39;s Stack

    ├──────────────────┤
    │                  │
    ├──────────────────┤     ◄──┐                   ◄──┐
    │        SS        │ +40    │                      │
    ├──────────────────┤        │                      │
    │        RSP       │ +32    │                      │
    ├──────────────────┤        │   Stack              │   Stack
    │       RFLAGS     │ +24    ├── Frame              ├── Frame 
    ├──────────────────┤        │  (no error code)     │  (with error code)
    │        CS        │ +16    │                      │
    ├──────────────────┤        │                      │
    │        RIP       │ +8     │                      │
    ├──────────────────┤     ◄──┘                      │
    │    Error Code    │  0                            │
    ├──────────────────┤                            ◄──┘
    │                  │
    ├──────────────────┤
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that some CPU exceptions push an error code onto the stack. For others, the error code is not pushed. So we have to be careful when defining the different interrupt handlers.</p><p>Given this information, we can&#39;t just define a normal procedure as an interrupt handler; we have to tell the compiler to generate it differently. Fortunately, the C compiler has a special attribute called <code>interrupt</code> that can be used to define interrupt handlers. It generates appropriate function entry/exit code so that it can be used directly as an interrupt service routine. We can use the <code>codegenDecl</code> pragma to add this attribute to our interrupt handler signature.</p><p>Let&#39;s define a proof of concept interrupt handler that prints a debug message.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">isr100</span><span class="token punctuation">(</span>frame<span class="token operator">:</span> pointer<span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">,</span> codegenDecl<span class="token operator">:</span> <span class="token string">&quot;__attribute__ ((interrupt)) $# $#$#&quot;</span><span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;Hello from isr100&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s install this handler in the IDT. We&#39;ll use the <code>newInterruptGate</code> helper function we defined earlier to create a new interrupt gate, and then we&#39;ll assign it to the appropriate entry in the IDT. We&#39;ll also load the IDT into the LDTR register using the <code>lidt</code> instruction.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">idtInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">:</span>
  idtEntries<span class="token punctuation">[</span><span class="token number">100</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">newInterruptGate</span><span class="token punctuation">(</span>isr100<span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    lidt %0
    :
    : &quot;m&quot;(\`idtDescriptor\`)
  &quot;&quot;&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>I installed the handler at interrupt vector 100. This is just an arbitrary choice for testing. Let&#39;s now test it out by raising an interrupt using the <code>int</code> instruction.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">import</span> idt
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span>

  <span class="token operator">...</span>

  debug <span class="token string">&quot;kernel: Initializing GDT &quot;</span>
  <span class="token function">gdtInit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  debugln <span class="token string">&quot;[success]&quot;</span>

  debug <span class="token string">&quot;kernel: Initializing IDT &quot;</span>
  <span class="token function">idtInit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  debugln <span class="token string">&quot;[success]&quot;</span>

  debugln <span class="token string">&quot;kernel: Invoking interrupt&quot;</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;int 100&quot;</span>
  debugln <span class="token string">&quot;kernel: Returned from interrupt&quot;</span>

  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we run the kernel now, we should see the debug message printed to the terminal.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Fusion Kernel
...
kernel: Initializing IDT [success]
kernel: Invoking interrupt
Hello from isr100
kernel: Returned from interrupt
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! We have a working interrupt handler. Now we&#39;re ready to define interrupt handlers for CPU exceptions.</p><h2 id="handling-cpu-exceptions" tabindex="-1"><a class="header-anchor" href="#handling-cpu-exceptions" aria-hidden="true">#</a> Handling CPU Exceptions</h2><p>As mentioned earlier, Intel reserves the first 32 entries in the IDT for CPU exceptions. Not all 32 are used. Here&#39;s the list of CPU exceptions and interrupts as defined in the Intel manual:</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>┌────────┬──────────┬─────────────────────────┬───────────┬───────┬────────────────────────────────────┐
│ Vector │ Mnemonic │ Description             │ Type      │ Error │ Source                             │
│        │          │                         │           │ Code  │                                    │
├────────┼──────────┼─────────────────────────┼───────────┼───────┼────────────────────────────────────┤
│ 0      │ #DE      │ Divide Error            │ Fault     │ No    │ DIV and IDIV instructions.         │
│ 1      │ #DB      │ Debug Exception         │ Fault /   │ No    │ Instruction, data, and I/O         │
│        │          │                         │ Trap      │       │ breakpoints; single-step; and      │
│        │          │                         │           │       │ others.                            │
│ 2      │ -        │ NMI Interrupt           │ Interrupt │ No    │ Nonmaskable external interrupt.    │
│ 3      │ #BP      │ Breakpoint              │ Trap      │ No    │ INT3 instruction.                  │
│ 4      │ #OF      │ Overflow                │ Trap      │ No    │ INTO instruction.                  │
│ 5      │ #BR      │ BOUND Range Exceeded    │ Fault     │ No    │ BOUND instruction.                 │
│ 6      │ #UD      │ Invalid Opcode          │ Fault     │ No    │ UD instruction or reserved opcode. │
│ 7      │ #NM      │ Device Not Available    │ Fault     │ No    │ Floating-point or WAIT/FWAIT       │
│        │          │ (No Math Coprocessor)   │           │       │ instruction.                       │
│ 8      │ #DF      │ Double Fault            │ Abort     │ Yes   │ Any instruction that can generate  │
│        │          │                         │           │ (zero)│ an exception, an NMI, or an INTR.  │
│ 9      │ -        │ Coprocessor Segment     │ Fault     │ No    │ Floating-point instruction.        │
│        │          │ Overrun (reserved)      │           │       │                                    │
│ 10     │ #TS      │ Invalid TSS             │ Fault     │ Yes   │ Task switch or TSS access.         │
│ 11     │ #NP      │ Segment Not Present     │ Fault     │ Yes   │ Loading segment registers or       │
│        │          │                         │           │       │ accessing system segments.         │
│ 12     │ #SS      │ Stack-Segment Fault     │ Fault     │ Yes   │ Stack operations and SS register   │
│        │          │                         │           │       │ loads.                             │
│ 13     │ #GP      │ General Protection      │ Fault     │ Yes   │ Any memory reference and other     │
│        │          │                         │           │       │ protection checks.                 │
│ 14     │ #PF      │ Page Fault              │ Fault     │ Yes   │ Any memory reference.              │
│ 15     │ -        │ (Intel reserved. Do not │ -         │ No    │ -                                  │
│        │          │ use.)                   │           │       │                                    │
│ 16     │ #MF      │ x87 FPU Floating-Point  │ Fault     │ No    │ x87 FPU floating-point or WAIT/    │
│        │          │ Error (Math Fault       │           │       │ FWAIT instruction.                 │
│ 17     │ #AC      │ Alignment Check         │ Fault     │ Yes   │ Any data reference in memory.      │
│        │          │                         │           │ (zero)│                                    │
│ 18     │ #MC      │ Machine Check           │ Abort     │ No    │ Error codes (if any) and source    │
│        │          │                         │           │       │ are model dependent.               │
│ 19     │ #XM      │ SIMD Floating-Point     │ Fault     │ No    │ SSE/SSE2/SSE3 floating-point       │
│        │          │ Exception               │           │       │ instructions.                      │
│ 20     │ #VE      │ Virtualization Exception│ Fault     │ No    │ EPT violation                      │
│ 21     │ #CP      │ Control Protection      │ Fault     │ Yes   │ RET, IRET, RSTORSSP, and SETSSBSY  │
│        │          │ Exception               │           │       │ instructions.                      │
│ 22-31  │ -        │ Intel Reserved. Do not  │ -         │ -     │ -                                  │
│        │          │ use.                    │           │       │                                    │
│ 32-255 │ -        │ User Defined            │ Interrupt │ -     │ External interrupt or INT n        │
│        │          │ use.                    │           │       │ instruction.                       │
└────────┴──────────┴─────────────────────────┴───────────┴───────┴────────────────────────────────────┘
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The difference between <strong>Fault</strong> and <strong>Trap</strong> exceptions is that upon returning from a Fault, the CPU will re-execute the instruction that caused the fault (e.g. a page fault handled may allocate the missing page and then return to the instruction that caused the page fault, with no loss of continuity). On the other hand, upon returning from a Trap, the CPU will continue execution from the next instruction (e.g. a breakpoint trap handler may print a debug message and then return to the next instruction). <strong>Abort</strong> exceptions are not recoverable, and usually indicate severe errors, such as hardware errors.</p><p>Let&#39;s start by defining an exception handler for the divide error exception. Because this exception is a Fault, it will be retried indifinitely by the CPU. To avoid an infinite loop, we&#39;ll just print a debug message (and the stack trace) and then quit the kernel.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>

<span class="token keyword">proc</span> <span class="token function">cpuDivideErrorHandler</span><span class="token punctuation">(</span>frame<span class="token operator">:</span> pointer<span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">,</span> codegenDecl<span class="token operator">:</span> <span class="token string">&quot;__attribute__ ((interrupt)) $# $#$#&quot;</span><span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;CPU Exception: Divide Error [#DE]&quot;</span>
  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token function">getStackTrace</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;ll also define a helper function to install the handler in the IDT.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>

<span class="token keyword">proc</span> <span class="token function">installHandler</span><span class="token punctuation">(</span>vector<span class="token operator">:</span> uint8<span class="token punctuation">,</span> handler<span class="token operator">:</span> InterruptHandler<span class="token punctuation">)</span> <span class="token operator">=</span>
  idtEntries<span class="token punctuation">[</span>vector<span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">newInterruptGate</span><span class="token punctuation">(</span>handler<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we can install the handler in the IDT.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>

<span class="token keyword">proc</span> <span class="token function">idtInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">:</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">,</span> divideErrorHandler<span class="token punctuation">)</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try it out by raising a divide error exception.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">import</span> idt

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>
  debugln <span class="token string">&quot;kernel: Invoking interrupt&quot;</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    # Divide by zero
    xor rcx, rcx
    idiv rcx
  &quot;&quot;&quot;</span>
  debugln <span class="token string">&quot;kernel: Returned from interrupt&quot;</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>When we run the kernel, we should see the debug message and the stack trace printed to the terminal.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Fusion Kernel
...
kernel: Initializing IDT [success]
kernel: Invoking interrupt

CPU Exception: Divide Error

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(58) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(87) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(68) cpuDivideErrorHandler
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! Our exception handler is working, and we can see the stack trace (since the interrupt is using the same stack). Now we can define handlers for the remaining CPU exceptions. But it would be tedious to write almost the same code for each handler. So let&#39;s use a Nim template to generate the handlers for us.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>

<span class="token keyword">template</span> <span class="token function">createHandler<span class="token operator">*</span></span><span class="token punctuation">(</span>name<span class="token operator">:</span> untyped<span class="token punctuation">,</span> msg<span class="token operator">:</span> string<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">proc</span> <span class="token function">name<span class="token operator">*</span></span><span class="token punctuation">(</span>frame<span class="token operator">:</span> pointer<span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">,</span> codegenDecl<span class="token operator">:</span> <span class="token string">&quot;__attribute__ ((interrupt)) $# $#$#&quot;</span><span class="token punctuation">.}</span> <span class="token operator">=</span>
    debugln <span class="token string">&quot;CPU Exception: &quot;</span><span class="token punctuation">,</span> msg
    debugln <span class="token string">&quot;&quot;</span>
    debugln <span class="token function">getStackTrace</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
    <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuDivideErrorHandler<span class="token punctuation">,</span> <span class="token string">&quot;Divide Error&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuDebugErrorHandler<span class="token punctuation">,</span> <span class="token string">&quot;Debug Exception&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuNmiInterruptHandler<span class="token punctuation">,</span> <span class="token string">&quot;NMI Interrupt&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuBreakpointHandler<span class="token punctuation">,</span> <span class="token string">&quot;Breakpoint&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuOverflowHandler<span class="token punctuation">,</span> <span class="token string">&quot;Overflow&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuBoundRangeExceededHandler<span class="token punctuation">,</span> <span class="token string">&quot;Bound Range Exceeded&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuInvalidOpcodeHandler<span class="token punctuation">,</span> <span class="token string">&quot;Invalid Opcode&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuDeviceNotAvailableHandler<span class="token punctuation">,</span> <span class="token string">&quot;Device Not Available&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuDoubleFaultHandler<span class="token punctuation">,</span> <span class="token string">&quot;Double Fault&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuCoprocessorSegmentOverrunHandler<span class="token punctuation">,</span> <span class="token string">&quot;Coprocessor Segment Overrun&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuInvalidTssHandler<span class="token punctuation">,</span> <span class="token string">&quot;Invalid TSS&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuSegmentNotPresentHandler<span class="token punctuation">,</span> <span class="token string">&quot;Segment Not Present&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuStackSegmentFaultHandler<span class="token punctuation">,</span> <span class="token string">&quot;Stack Segment Fault&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuGeneralProtectionFaultHandler<span class="token punctuation">,</span> <span class="token string">&quot;General Protection Fault&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuPageFaultHandler<span class="token punctuation">,</span> <span class="token string">&quot;Page Fault&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuX87FloatingPointErrorHandler<span class="token punctuation">,</span> <span class="token string">&quot;x87 Floating Point Error&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuAlignmentCheckHandler<span class="token punctuation">,</span> <span class="token string">&quot;Alignment Check&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuMachineCheckHandler<span class="token punctuation">,</span> <span class="token string">&quot;Machine Check&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuSimdFloatingPointExceptionHandler<span class="token punctuation">,</span> <span class="token string">&quot;SIMD Floating Point Exception&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuVirtualizationExceptionHandler<span class="token punctuation">,</span> <span class="token string">&quot;Virtualization Exception&quot;</span><span class="token punctuation">)</span>
<span class="token function">createHandler</span><span class="token punctuation">(</span>cpuControlProtectionExceptionHandler<span class="token punctuation">,</span> <span class="token string">&quot;Control Protection Exception&quot;</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we can install the handlers in the IDT.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">idtInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">0</span><span class="token punctuation">,</span> cpuDivideErrorHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">,</span> cpuDebugErrorHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">2</span><span class="token punctuation">,</span> cpuNmiInterruptHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">3</span><span class="token punctuation">,</span> cpuBreakpointHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">4</span><span class="token punctuation">,</span> cpuOverflowHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">5</span><span class="token punctuation">,</span> cpuBoundRangeExceededHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">6</span><span class="token punctuation">,</span> cpuInvalidOpcodeHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">7</span><span class="token punctuation">,</span> cpuDeviceNotAvailableHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">8</span><span class="token punctuation">,</span> cpuDoubleFaultHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">9</span><span class="token punctuation">,</span> cpuCoprocessorSegmentOverrunHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">10</span><span class="token punctuation">,</span> cpuInvalidTssHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">11</span><span class="token punctuation">,</span> cpuSegmentNotPresentHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">12</span><span class="token punctuation">,</span> cpuStackSegmentFaultHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">13</span><span class="token punctuation">,</span> cpuGeneralProtectionFaultHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">14</span><span class="token punctuation">,</span> cpuPageFaultHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">16</span><span class="token punctuation">,</span> cpuX87FloatingPointErrorHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">17</span><span class="token punctuation">,</span> cpuAlignmentCheckHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">18</span><span class="token punctuation">,</span> cpuMachineCheckHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">19</span><span class="token punctuation">,</span> cpuSimdFloatingPointExceptionHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">20</span><span class="token punctuation">,</span> cpuVirtualizationExceptionHandler<span class="token punctuation">)</span>
  <span class="token function">installHandler</span><span class="token punctuation">(</span><span class="token number">21</span><span class="token punctuation">,</span> cpuControlProtectionExceptionHandler<span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    lidt %0
    :
    : &quot;m&quot;(\`idtDescriptor\`)
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="page-fault-handler" tabindex="-1"><a class="header-anchor" href="#page-fault-handler" aria-hidden="true">#</a> Page Fault Handler</h2><p>One particular interrupt handler that we need to customize a bit is the <strong>Page Fault</strong> handler. When this exception is raised, the CPU stores the address that caused the page fault in the <code>CR2</code> register. At some point we&#39;ll use this address to allocate a new page and map it to the address that caused the page fault. But for now, let&#39;s just print the address and quit.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>

<span class="token comment"># remove this line from before:</span>
<span class="token comment">#   createHandler(cpuPageFaultHandler, &quot;Page Fault&quot;)</span>

<span class="token keyword">proc</span> <span class="token function">cpuPageFaultHandler<span class="token operator">*</span></span><span class="token punctuation">(</span>frame<span class="token operator">:</span> pointer<span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">,</span> codegenDecl<span class="token operator">:</span> <span class="token string">&quot;__attribute__ ((interrupt)) $# $#$#&quot;</span><span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token string">&quot;CPU Exception: Page Fault&quot;</span>
  <span class="token comment"># get the faulting address</span>
  <span class="token keyword">var</span> cr2<span class="token operator">:</span> uint64
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov %0, cr2
    : &quot;=r&quot;(\`cr2\`)
  &quot;&quot;&quot;</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;    Faulting address: {cr2:#018x}&quot;</span>
  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token function">getStackTrace</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try it out by raising a page fault exception.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">import</span> idt

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span><span class="token operator">..</span><span class="token punctuation">.)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>
  debugln <span class="token string">&quot;kernel: Invoking interrupt&quot;</span>
  <span class="token keyword">let</span> p <span class="token operator">=</span> <span class="token function">cast[ptr uint8]</span><span class="token punctuation">(</span><span class="token number">0xdeadbeef</span><span class="token punctuation">)</span>
  <span class="token keyword">let</span> x <span class="token operator">=</span> p<span class="token punctuation">[</span><span class="token punctuation">]</span>
  debugln <span class="token string">&quot;kernel: Returned from interrupt&quot;</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>And when we run the kernel, we should see the page fault error message.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Fusion Kernel
kernel: Initializing IDT [success]
kernel: Invoking interrupt

CPU Exception: Page Fault
    Faulting address: 0x00000000deadbeef

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(58) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(88) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(57) pageFaultHandler
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Beautiful! The handler is working, and we know which address caused the page fault. One thing we can test also is double faults. We can try this by commenting out the installation of the page fault handler, and then causing a page fault. The CPU will then raise a double fault exception, because it can&#39;t find an interrupt handler during another exception (the page fault).</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/idt.nim</span>

<span class="token keyword">proc</span> <span class="token function">idtInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>
  <span class="token comment"># installHandler(14, cpuPageFaultHandler)</span>
  <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we run the kernel now, we should see the double fault error message.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Fusion Kernel
...
kernel: Initializing IDT [success]
kernel: Invoking interrupt

CPU Exception: Double Fault

Traceback (most recent call last)
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(58) KernelMain
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/main.nim(88) KernelMainInner
/Users/khaledhammouda/src/github.com/khaledh/fusion/src/kernel/idt.nim(65) cpuDoubleFaultHandler
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Amazing! We now have a safety net for CPU exceptions. If we mess up something in the kernel, we should get a debug message instead of a random hang or reboot. We will come back to properly implement some of these handlers later, especially the page fault handler.</p><p>Let&#39;s now turn our attention to user mode. In the next section, we&#39;ll see how we can switch to user mode, while still allowing interrupts to occur.</p>`,61),l=[i];function o(r,p){return s(),e("div",null,l)}const u=n(t,[["render",o],["__file","15-interrupts.html.vue"]]);export{u as default};
