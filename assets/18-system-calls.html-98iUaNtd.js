import{_ as s,o as n,c as e,e as a}from"./app-OxDYV5f1.js";const i={},l=a(`<h1 id="system-calls" tabindex="-1"><a class="header-anchor" href="#system-calls" aria-hidden="true">#</a> System Calls</h1><p>User programs run in a restricted environment. They can&#39;t access hardware directly, allocate memory, or do any privileged operations. Instead, they must ask the kernel to do these things for them. The kernel provides these services through system calls. System calls are the interface between user programs and the kernel.</p><p>Transferring control to the kernel requires special support from the CPU. Traditionally, this has been done using software interrupts, e.g. <code>int 0x80</code> in Linux. However, modern CPUs provide a more efficient way to do this: the <code>syscall</code>/<code>sysret</code> instruction pair.</p><h2 id="system-call-interface" tabindex="-1"><a class="header-anchor" href="#system-call-interface" aria-hidden="true">#</a> System Call Interface</h2><p>The <code>syscall</code>/<code>sysret</code> instructions simply transfers control to the kernel and back to the user program. They don&#39;t define the interface between user programs and the kernel. The kernel defines this interface, i.e. the system call numbers and the arguments for each system call. The kernel also defines the calling convention for system calls, e.g. which registers to use for arguments and return values. This is called Application Binary Interface (ABI).</p><p>We&#39;re not building a kernel adhering to any particular ABI; we&#39;ll define our own. Let&#39;s start with the system call number and arguments. We&#39;ll use the following registers for these:</p><ul><li><code>rdi</code>: system call number</li><li><code>rsi</code>: first argument</li><li><code>rdx</code>: second argument</li><li><code>rcx</code>: third argument</li><li><code>r8</code>: fourth argument</li><li><code>r9</code>: fifth argument</li></ul><p>We&#39;ll use <code>rax</code> for the return value.</p><p>When executing <code>syscall</code>, the CPU stores the user <code>RIP</code> and <code>RFLAGS</code> in <code>rcx</code> and <code>r11</code> respectively. Upoin returning to user mode, the CPU restores <code>RIP</code> and <code>RFLAGS</code> from <code>rcx</code> and <code>r11</code>. So we have to make sure that <code>rcx</code> and <code>r11</code> are preserved across system calls.</p><p>Also, the CPU doesn&#39;t switch stacks for us when executing <code>syscall</code>. We have to do that ourselves. This is in contrast with interrupts, where the CPU switches to the kernel stack before executing the interrupt handler. So it&#39;s a bit more inconvenient to handle system calls than interrupts, but it&#39;s a faster mechanism.</p><h2 id="initialization" tabindex="-1"><a class="header-anchor" href="#initialization" aria-hidden="true">#</a> Initialization</h2><p>There&#39;s a few things we need to do to initialize system calls. They&#39;re all done through Model Specific Registers (MSRs).</p><ul><li>Set the <code>SCE</code> (SYSCALL Enable) flag in the <code>IA32_EFER</code> MSR.</li><li>Set the kernel and user mode segment selectors in the <code>IA32_STAR</code> MSR.</li><li>Set the syscall entry point in the <code>IA32_LSTAR</code> MSR.</li><li>Set the kernel mode CPU flags mask in the <code>IA32_FMASK</code> MSR.</li></ul><p>Since we&#39;re going to be reading/writing CPU registers, let&#39;s create a module for that. Let&#39;s add <code>src/kernel/cpu.nim</code> and define some constants for the MSRs, and two procs to read/write them.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/cpu.nim</span>

<span class="token keyword">const</span>
  IA32_EFER<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0xC0000080&#39;u32</span>

  IA32_STAR<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0xC0000081&#39;u32</span>
  IA32_LSTAR<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0xC0000082&#39;u32</span>
  IA32_FMASK<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0xC0000084&#39;u32</span>

<span class="token keyword">proc</span> <span class="token function">readMSR<span class="token operator">*</span></span><span class="token punctuation">(</span>ecx<span class="token operator">:</span> uint32<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token operator">=</span>
  <span class="token keyword">var</span> eax<span class="token punctuation">,</span> edx<span class="token operator">:</span> uint32
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    rdmsr
    : &quot;=a&quot;(\`eax\`), &quot;=d&quot;(\`edx\`)
    : &quot;c&quot;(\`ecx\`)
  &quot;&quot;&quot;</span>
  result <span class="token operator">=</span> <span class="token punctuation">(</span>edx<span class="token operator">.</span>uint64 <span class="token operator">shl</span> <span class="token number">32</span><span class="token punctuation">)</span> <span class="token operator">or</span> eax

<span class="token keyword">proc</span> <span class="token function">writeMSR<span class="token operator">*</span></span><span class="token punctuation">(</span>ecx<span class="token operator">:</span> uint32<span class="token punctuation">,</span> value<span class="token operator">:</span> uint64<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">var</span> eax<span class="token punctuation">,</span> edx<span class="token operator">:</span> uint32
  eax <span class="token operator">=</span> value<span class="token operator">.</span>uint32
  edx <span class="token operator">=</span> <span class="token punctuation">(</span>value <span class="token operator">shr</span> <span class="token number">32</span><span class="token punctuation">)</span><span class="token operator">.</span>uint32
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    wrmsr
    :
    : &quot;c&quot;(\`ecx\`), &quot;a&quot;(\`eax\`), &quot;d&quot;(\`edx\`)
  &quot;&quot;&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s create another module <code>src/kernel/syscalls.nim</code> and add a proc to initialize system calls, and a dummy syscall entry point.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">import</span> cpu
<span class="token keyword">import</span> gdt

<span class="token keyword">proc</span> <span class="token function">syscallEntry</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>asmNoStackFrame<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token comment"># just halt for now</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    cli
    hlt
  &quot;&quot;&quot;</span>

<span class="token keyword">proc</span> <span class="token function">syscallInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token comment"># enable syscall feature</span>
  <span class="token function">writeMSR</span><span class="token punctuation">(</span>IA32_EFER<span class="token punctuation">,</span> <span class="token function">readMSR</span><span class="token punctuation">(</span>IA32_EFER<span class="token punctuation">)</span> <span class="token operator">or</span> <span class="token number">1</span><span class="token punctuation">)</span>  <span class="token comment"># Bit 0: SYSCALL Enable</span>

  <span class="token comment"># set up segment selectors in IA32_STAR (Syscall Target Address Register)</span>
  <span class="token comment"># note that for SYSCALL, the kernel segment selectors are:</span>
  <span class="token comment">#   CS: IA32_STAR[47:32]</span>
  <span class="token comment">#   SS: IA32_STAR[47:32] + 8</span>
  <span class="token comment"># and for SYSRET, the user segment selectors are:</span>
  <span class="token comment">#   CS: IA32_STAR[63:48] + 16</span>
  <span class="token comment">#   SS: IA32_STAR[63:48] + 8</span>
  <span class="token comment"># thus, setting both parts of the register to KernelCodeSegmentSelector</span>
  <span class="token comment"># satisfies both requirements (+0 is kernrel CS, +8 is data segment, +16 is user CS)</span>
  <span class="token keyword">let</span> star <span class="token operator">=</span> <span class="token punctuation">(</span>
    <span class="token punctuation">(</span>KernelCodeSegmentSelector<span class="token operator">.</span>uint64 <span class="token operator">shl</span> <span class="token number">32</span><span class="token punctuation">)</span> <span class="token function">or</span>
    <span class="token punctuation">(</span>KernelCodeSegmentSelector<span class="token operator">.</span>uint64 <span class="token operator">shl</span> <span class="token number">48</span><span class="token punctuation">)</span>
  <span class="token punctuation">)</span>
  <span class="token function">writeMSR</span><span class="token punctuation">(</span>IA32_STAR<span class="token punctuation">,</span> star<span class="token punctuation">)</span>

  <span class="token comment"># set up syscall entry point</span>
  <span class="token function">writeMSR</span><span class="token punctuation">(</span>IA32_LSTAR<span class="token punctuation">,</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>syscallEntry<span class="token punctuation">)</span><span class="token punctuation">)</span>

  <span class="token comment"># set up flags mask (should mask interrupt flag to disable interrupts)</span>
  <span class="token function">writeMSR</span><span class="token punctuation">(</span>IA32_FMASK<span class="token punctuation">,</span> <span class="token number">0x200</span><span class="token punctuation">)</span>  <span class="token comment"># rflags will be ANDed with the *complement* of this value</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The <code>syscallEntry</code> proc is a low-level entry point for system calls, hence the pure assembly. We can&#39;t rely on conventional prologue/epilogue code here, since the CPU doesn&#39;t switch stacks for us. We&#39;ll have to do that ourselves as early as possible in the entry point. Right now we just want to make sure that the syscall transition to kernel mode works.</p><p>The <code>syscallInit</code> proc does the actual initialization. It enables the syscall feature, sets up the segment selectors, sets the syscall entry point, and sets the flags mask. The flags mask is used to <em>clear</em> the flags corresponding to the bits set in the mask when entering kernel mode.</p><p>Finally, let&#39;s call <code>syscallInit</code> from <code>src/kernel/main.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">import</span> syscalls
<span class="token operator">..</span>

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span>

  <span class="token operator">...</span>

  debug <span class="token string">&quot;kernel: Initializing Syscalls &quot;</span>
  <span class="token function">syscallInit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  debugln <span class="token string">&quot;[success]&quot;</span>
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="invoking-system-calls" tabindex="-1"><a class="header-anchor" href="#invoking-system-calls" aria-hidden="true">#</a> Invoking System Calls</h2><p>We should now be able to invoke system calls from user mode. Let&#39;s modify our user program to do that. We&#39;re going to pass the system call number in <code>rdi</code>, but we won&#39;t pass any arguments for now.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rdi, 1
    syscall

  .loop:
    pause
    jmp .loop
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try this out and use the QEMU monitor to check where execution stops.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>(qemu) x /2i $eip-2
0xffff800000120490:  fa                       cli
0xffff800000120491:  f4                       hlt
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The command <code>x /2i $eip-2</code> disassembles the two instructions just before the current instruction pointer, which shows that we&#39;re executing the <code>cli</code> and <code>hlt</code> instructions in <code>syscallEntry</code>. Just to double-check, we can confirm this by comparing the value of <code>rip</code> with the address of <code>syscallEntry</code> from the kernel linker map.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>ffff800000120490 ffff800000120490       4e    16    .../fusion/build/@msyscalls.nim.c.o:(.ltext.syscallEntry__syscalls_u23)
ffff800000120490 ffff800000120490       4e     1            syscallEntry__syscalls_u23
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div></div></div><p>Indeed, the value of <code>rip - 2</code> is the same as the address of <code>syscallEntry</code>.</p><p>Now, let&#39;s check the CPU registers.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>(qemu) info registers
CPU#0
RAX=ffff800000327540 RBX=ffff800000327548 RCX=0000000040000067 RDX=000000004000add8
RSI=0000000000000001 RDI=0000000000000001 RBP=0000000050000ff8 RSP=0000000050000fc8
R8 =ffff800100003c00 R9 =0000000000000000 R10=0000000000000000 R11=0000000000000202
R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0
RIP=ffff8000001204a9 RFL=00000002 [-------] CPL=0 II=0 A20=1 SMM=0 HLT=1
ES =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
CS =0008 0000000000000000 ffffffff 00a09b00 DPL=0 CS64 [-RA]
SS =0010 0000000000000000 ffffffff 00c09300 DPL=0 DS   [-WA]
DS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
FS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
GS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
LDT=0000 0000000000000000 0000ffff 00008200 DPL=0 LDT
TR =0020 ffff800000326430 00000067 00008900 DPL=0 TSS64-avl
GDT=     ffff8000003264d0 0000002f
IDT=     ffff800000326500 00000fff
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The three registers important to us here are <code>rcx</code>, <code>r11</code>, and <code>rdi</code>:</p><ul><li><code>rcx</code> contains the user <code>rip</code> to return to after the system call (<code>0x40000067</code>)</li><li><code>r11</code> contains the user <code>rflags</code> to restore after the system call (<code>0x202</code>)</li><li><code>rdi</code> contains the system call number (<code>1</code>)</li></ul><p>We can also see that <code>CS</code> and <code>SS</code> are set to the kernel code and data segments, respectively, and their DPL=0. <code>rflags</code> also has the <code>IF</code> (interrupt flag) cleared. So everything looks good so far. Notice that <code>rsp</code> is set to <code>0x50000fc8</code>, which is within the user stack. As I mentioned earlier, we&#39;ll need to switch to the kernel stack ourselves.</p><p>Let&#39;s test <code>sysret</code> to make sure we can return to user mode. We&#39;ll modify <code>syscallEntry</code> to put a dummy value in <code>rax</code> as a return code, and then call <code>sysretq</code> (the <code>q</code> suffix is for returning to 64-bit mode; otherwise, <code>sysret</code> would return to 32-bit compatibility mode).</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">syscallEntry</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>asmNoStackFrame<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rax, 0x5050
    sysretq
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s run it and see where we stop.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>(qemu) x /2i $eip-2
0x40000067:  f3 90                    pause
0x40000069:  e9 f9 ff ff ff           jmp      0x40000067
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;re now executing the <code>pause</code> loop in <code>UserMain</code>, so we&#39;re back in user mode. Let&#39;s check the registers.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>(qemu) info registers
CPU#0
RAX=0000000000005050 RBX=0000000000000000 RCX=0000000040000067 RDX=000000004000add8
RSI=0000000000000001 RDI=0000000000000001 RBP=0000000050000ff8 RSP=0000000050000fc8
R8 =ffff800100003c00 R9 =0000000000000000 R10=000000000636d001 R11=0000000000000202
R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0
RIP=0000000040000069 RFL=00000202 [-------] CPL=3 II=0 A20=1 SMM=0 HLT=0
ES =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
CS =001b 0000000000000000 ffffffff 00a0fb00 DPL=3 CS64 [-RA]
SS =0013 0000000000000000 ffffffff 00c0f300 DPL=3 DS   [-WA]
DS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
FS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
GS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
LDT=0000 0000000000000000 0000ffff 00008200 DPL=0 LDT
TR =0020 ffff8000003263f0 00000067 00008900 DPL=0 TSS64-avl
GDT=     ffff800000326490 0000002f
IDT=     ffff8000003264c0 00000fff
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We can see that <code>rip</code> is back in user space, and <code>CS</code> and <code>SS</code> are set to user code and data segments, respectively, and their DPL=3. The <code>rflags</code> are also restored to the user value with interrupts enabled. Everything looks good.</p><h2 id="switching-stacks" tabindex="-1"><a class="header-anchor" href="#switching-stacks" aria-hidden="true">#</a> Switching Stacks</h2><p>As I mentioned earlier, the CPU doesn&#39;t switch stacks for us when executing <code>syscall</code>. We need to switch to a kernel stack ourselves. We&#39;ll use the same stack we use for interrupts, the one we stored its address in <code>tss.rsp0</code>. We&#39;ll also need to save the user <code>rsp</code> somewhere so we can restore it later. We&#39;ll define two global variables for this in the <code>syscalls</code> module.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">var</span>
  kernelStackAddr<span class="token operator">:</span> uint64
  userRsp<span class="token operator">:</span> uint64
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">syscallInit<span class="token operator">*</span></span><span class="token punctuation">(</span>kernelStack<span class="token operator">:</span> uint64<span class="token punctuation">)</span> <span class="token operator">=</span>
  kernelStackAddr <span class="token operator">=</span> kernelStack
  <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s pass the kernel stack address to <code>syscallInit</code> from <code>main.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">import</span> syscalls

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span>

  <span class="token operator">...</span>

  <span class="token comment"># create a kernel switch stack and set tss.rsp0</span>
  debugln <span class="token string">&quot;kernel: Creating kernel switch stack&quot;</span>
  <span class="token operator">...</span>

  debug <span class="token string">&quot;kernel: Initializing Syscalls &quot;</span>
  <span class="token function">syscallInit</span><span class="token punctuation">(</span>tss<span class="token operator">.</span>rsp0<span class="token punctuation">)</span>
  debugln <span class="token string">&quot;[success]&quot;</span>

  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s modify <code>syscallEntry</code> to switch to the kernel stack and save the user <code>rsp</code>. We&#39;ll also push <code>rcx</code> and <code>r11</code> (user <code>rip</code> and <code>rflags</code>, respectively) on the kernel stack and restore them before calling <code>sysretq</code> to return to user mode.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">proc</span> <span class="token function">syscallEntry</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>asmNoStackFrame<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    # switch to kernel stack
    mov %0, rsp
    mov rsp, %1

    # save user rip and rflags    
    push rcx
    push r11

    # TODO: dispatch system call

    # restore user rip and rflags
    pop r11
    pop rcx

    # switch to user stack
    mov rsp, %0

    sysretq
    : &quot;+r&quot;(\`userRsp\`)
    : &quot;m&quot;(\`kernelStackAddr\`)
    : &quot;rcx&quot;, &quot;r11&quot;
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Right now, we&#39;re not doing much to handle the system call itself. We&#39;re just switching stacks, and saving and restoring the user <code>rip</code> and <code>rflags</code>. In order to do something useful, we need to define a system call handler and a way to pass arguments to it.</p><h2 id="system-call-handler" tabindex="-1"><a class="header-anchor" href="#system-call-handler" aria-hidden="true">#</a> System Call Handler</h2><p>Let&#39;s now define the actual system call handler. We&#39;ll define a <code>SyscallArgs</code> type to hold the system call number and arguments, and implement a <code>syscall</code> proc that takes a pointer to <code>SyscallArgs</code> and returns a <code>uint64</code> as the return value.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">type</span>
  SyscallArgs<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    num<span class="token operator">:</span> uint64
    arg1<span class="token punctuation">,</span> arg2<span class="token punctuation">,</span> arg3<span class="token punctuation">,</span> arg4<span class="token punctuation">,</span> arg5<span class="token operator">:</span> uint64

<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">syscall<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;syscall: num={args.num}&quot;</span>
  result <span class="token operator">=</span> <span class="token number">0x5050</span>  <span class="token comment"># dummy return value</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that we&#39;re using the <code>exportc</code> pragma to export the <code>syscall</code> proc, since we&#39;ll be calling it from assembly code.</p><p>Now, let&#39;s modify <code>syscallEntry</code> to call <code>syscall</code> with the system call number and arguments. We&#39;ll create the <code>SyscallArgs</code> object on the kernel stack by pushing the appropriate registers, and pass its address to <code>syscall</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">syscallEntry</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>asmNoStackFrame<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    # switch to kernel stack
    mov %0, rsp
    mov rsp, %1

    push r11  # user rflags
    push rcx  # user rip

    # create SyscallArgs on stack
    push r9
    push r8
    push rcx
    push rdx
    push rsi
    push rdi

    mov rdi, rsp  # address of SyscallArgs
    call syscall

    # restore registers
    pop rdi
    pop rsi
    pop rdx
    pop rcx
    pop r8
    pop r9

    # prepare for sysret
    pop rcx  # rip
    pop r11  # rflags

    # switch to user stack
    mov rsp, %0

    sysretq
    : &quot;+r&quot;(\`userRsp\`)
    : &quot;m&quot;(\`kernelStackAddr\`)
    : &quot;rcx&quot;, &quot;r11&quot;, &quot;rdi&quot;, &quot;rsi&quot;, &quot;rdx&quot;, &quot;rcx&quot;, &quot;r8&quot;, &quot;r9&quot;, &quot;rax&quot;
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that on the last line we&#39;re telling the compiler that <code>syscallEntry</code> clobbers the indicated registers. Otherwise, the compiler might try to use them for other purposes.</p><p>Let&#39;s try this out. We still have the user program passing <code>1</code>, so we should see that printed by <code>syscall</code>, and the dummy return value <code>0x5050</code> should be in <code>rax</code> when we return to user mode.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=1
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! The <code>syscall</code> proc was called and received the correct syscall number. Let&#39;s look at the <code>rax</code> register to see if it contains the dummy return value.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>(qemu) info registers
CPU#0
RAX=0000000000005050 RBX=ffff800000327220 RCX=0000000040000074 RDX=000000004000ade8
RSI=0000000000000001 RDI=0000000000000001 RBP=0000000050000ff8 RSP=0000000050000fc8
R8 =ffff800100003c00 R9 =0000000000000000 R10=0000000050000fc8 R11=0000000000000202
R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0
RIP=0000000040000076 RFL=00000202 [-------] CPL=3 II=0 A20=1 SMM=0 HLT=0
ES =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]
CS =001b 0000000000000000 ffffffff 00a0fb00 DPL=3 CS64 [-RA]
SS =0013 0000000000000000 ffffffff 00c0f300 DPL=3 DS   [-WA]
...
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Indeed, <code>rax</code> contains <code>0x5050</code>, and from the <code>rip</code>, <code>cs</code>, and <code>ss</code> register values we can see that we&#39;re back in user mode. So everything is working as expected.</p><h2 id="system-call-table" tabindex="-1"><a class="header-anchor" href="#system-call-table" aria-hidden="true">#</a> System Call Table</h2><p>Over time, we&#39;ll have more system calls, so we&#39;ll need a way to dispatch them. One way to do this is store the system call handlers in a table indexed by the system call number. Let&#39;s create that table.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">type</span>
  SyscallHandler<span class="token operator">*</span> <span class="token operator">=</span> <span class="token function">proc</span> <span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
  SyscallArgs <span class="token operator">=</span> <span class="token keyword">object</span>
    num<span class="token operator">:</span> uint64
    arg1<span class="token punctuation">,</span> arg2<span class="token punctuation">,</span> arg3<span class="token punctuation">,</span> arg4<span class="token punctuation">,</span> arg5<span class="token operator">:</span> uint64
  SyscallError<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">enum</span>
    None
    InvalidSyscall

<span class="token keyword">var</span>
  syscallTable<span class="token operator">:</span> array<span class="token punctuation">[</span><span class="token number">256</span><span class="token punctuation">,</span> SyscallHandler<span class="token punctuation">]</span>

<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">syscall<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;syscall: num={args.num}&quot;</span>
  <span class="token keyword">if</span> args<span class="token operator">.</span>num <span class="token operator">&gt;</span> syscallTable<span class="token operator">.</span>high<span class="token operator">.</span>uint64 <span class="token operator">or</span> syscallTable<span class="token punctuation">[</span>args<span class="token operator">.</span>num<span class="token punctuation">]</span> <span class="token operator">==</span> <span class="token keyword">nil</span><span class="token operator">:</span>
    <span class="token keyword">return</span> InvalidSyscall<span class="token operator">.</span>uint64
  result <span class="token operator">=</span> <span class="token function">syscallTable[args.num]</span><span class="token punctuation">(</span>args<span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s define a system call to output a string to the debug console. The system call will take one argumet: a pointer to a <code>string</code> object containing the string to output. We&#39;ll register the system call handler in <code>syscallInit</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">print<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;syscall: print&quot;</span>
  <span class="token keyword">let</span> s <span class="token operator">=</span> <span class="token function">cast[ptr string]</span><span class="token punctuation">(</span>args<span class="token operator">.</span>arg1<span class="token punctuation">)</span>
  debugln s<span class="token punctuation">[</span><span class="token punctuation">]</span>
  result <span class="token operator">=</span> <span class="token number">0</span>

<span class="token keyword">proc</span> <span class="token function">syscallInit<span class="token operator">*</span></span><span class="token punctuation">(</span>kernelStack<span class="token operator">:</span> uint64<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>
  syscallTable<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> print
  <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try to invoke this system call from our user program.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>
<span class="token operator">...</span>

<span class="token keyword">let</span>
  msg <span class="token operator">=</span> <span class="token string">&quot;user: Hello from user mode!&quot;</span>
  pmsg <span class="token operator">=</span> msg<span class="token operator">.</span><span class="token keyword">addr</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rdi, 1
    mov rsi, %0
    syscall

  .loop:
    pause
    jmp .loop
    :
    : &quot;r&quot;(\`pmsg\`)
    : &quot;rdi&quot;, &quot;rsi&quot;
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;re passing the system call number <code>1</code> in <code>rdi</code>, and the address of the string in <code>rsi</code>. Let&#39;s run it and see what happens.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=1
syscall: print
user: Hello from user mode!
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! We can now ask the kernel to print a string for us. This is our first kernel service provided through a system call!</p><h2 id="argument-validation" tabindex="-1"><a class="header-anchor" href="#argument-validation" aria-hidden="true">#</a> Argument Validation</h2><p>There&#39;s one important piece missing though. Arguments to system calls have to be validated thoroughly. We can&#39;t just blindly trust the user program to pass valid arguments. We already did this for the system call number. But what about the string pointer? The user can pass any pointer value, so it&#39;s imperative that we validate it before dereferencing it. In this case, we&#39;ll keep it simple and make sure that the pointer is within the user address space. We can check if it&#39;s mapped, but that&#39;s going to be expensive. Instead, we&#39;ll just check if it&#39;s within the user address space range, and if it isn&#39;t mapped, we&#39;ll let the page fault handler deal with it.</p><p>Here&#39;s the modified <code>print</code> system call.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">type</span>
  SyscallError<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">enum</span>
    None
    InvalidSyscall
    InvalidArg

<span class="token keyword">const</span>
  UserAddrSpaceEnd<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0x00007FFFFFFFFFFF</span>

<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">print<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;syscall: print&quot;</span>

  <span class="token keyword">if</span> args<span class="token operator">.</span>arg1 <span class="token operator">&gt;</span> UserAddrSpaceEnd<span class="token operator">:</span>
    debugln <span class="token string">&quot;syscall: print: Invalid pointer&quot;</span>
    <span class="token keyword">return</span> InvalidArg<span class="token operator">.</span>uint64

  <span class="token keyword">let</span> s <span class="token operator">=</span> <span class="token function">cast[ptr string]</span><span class="token punctuation">(</span>args<span class="token operator">.</span>arg1<span class="token punctuation">)</span>
  debugln s<span class="token punctuation">[</span><span class="token punctuation">]</span>

  result <span class="token operator">=</span> <span class="token number">0</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try it out by passing an address in kernel space to the system call.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>

<span class="token keyword">let</span>
  msg <span class="token operator">=</span> <span class="token string">&quot;user: Hello from user mode!&quot;</span>
  pmsg <span class="token operator">=</span> <span class="token number">0xffff800000100000</span>  <span class="token comment"># kernel space address</span>

<span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we run this, we should see the error message printed by the kernel.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=1
syscall: print
syscall: print: Invalid pointer
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Awesome! Our argument validation works as expected.</p><h2 id="the-exit-system-call" tabindex="-1"><a class="header-anchor" href="#the-exit-system-call" aria-hidden="true">#</a> The <code>exit</code> System Call</h2><p>Before we leave this section, let&#39;s add one more system call: <code>exit</code>. This system call will take one argument: the exit code. Keep in mind that we don&#39;t have a scheduler yet; our kernel transferred control to the user program, the user program called a system call to print a message, and will exit user mode in one thread of execution. So, without other tasks to switch to at the moment, we&#39;ll just halt the CPU when the user program exits.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">proc</span> <span class="token function">exit<span class="token operator">*</span></span><span class="token punctuation">(</span>args<span class="token operator">:</span> <span class="token keyword">ptr</span> SyscallArgs<span class="token punctuation">)</span><span class="token operator">:</span> uint64 <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span> <span class="token operator">=</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;syscall: exit: code={args.arg1}&quot;</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    cli
    hlt
  &quot;&quot;&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;ll give the <code>exit</code> system call the number 1 instead of <code>print</code>, and we&#39;ll make print system call number 2.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">syscallInit<span class="token operator">*</span></span><span class="token punctuation">(</span>kernelStack<span class="token operator">:</span> uint64<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>
  syscallTable<span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> exit
  syscallTable<span class="token punctuation">[</span><span class="token number">2</span><span class="token punctuation">]</span> <span class="token operator">=</span> print
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s modify the user program to call <code>exit</code> after printing the message.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/user/utask.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">UserMain<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    # call print
    mov rdi, 2
    mov rsi, %0
    syscall

    # call exit
    mov rdi, 1
    mov rsi, 0
    syscall
    :
    : &quot;r&quot;(\`pmsg\`)
    : &quot;rdi&quot;, &quot;rsi&quot;
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that I removed the infinite loop, as as the <code>exit</code> syscall does not return. Let&#39;s run it and see what happens.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=2
syscall: print
user: Hello from user mode!
syscall: num=1
syscall: exit: code=0
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Looks good! The <code>exit</code> system call was called and received the correct exit code, and the kernel halted the CPU.</p><p>This is another big milestone. We now have a working system call interface, and we can invoke kernel services from user mode. In the next section, we&#39;ll look into encapsulating user task related context in a <code>Task</code> object.</p>`,91),t=[l];function r(o,c){return n(),e("div",null,t)}const p=s(i,[["render",r],["__file","18-system-calls.html.vue"]]);export{p as default};
