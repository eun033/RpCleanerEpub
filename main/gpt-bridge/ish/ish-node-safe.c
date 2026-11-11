#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>

#if !defined(__i386__)
#error "This shim requires 32-bit x86"
#endif

__attribute__((visibility("hidden")))
void *ish_real_syscall = 0;

__attribute__((constructor))
static void ish_init(void) {
    ish_real_syscall = dlsym(RTLD_NEXT, "syscall");
}

__attribute__((used, noinline, visibility("hidden")))
long ish_enosys(void) {
    errno = ENOSYS;
    return -1;
}

__asm__(
".text\n"
".hidden ish_real_syscall\n"
".hidden ish_enosys\n"
".globl syscall\n"
".type syscall, @function\n"
"syscall:\n"
"cmpl $425, 4(%esp)\n"
"je ish_enosys\n"
"cmpl $426, 4(%esp)\n"
"je ish_enosys\n"
"cmpl $427, 4(%esp)\n"
"je ish_enosys\n"
"call 1f\n"
"1: popl %eax\n"
"movl ish_real_syscall-1b(%eax), %eax\n"
"testl %eax, %eax\n"
"je ish_enosys\n"
"jmp *%eax\n"
".size syscall, .-syscall\n"
);
