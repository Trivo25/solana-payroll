<template>
  <div
    class="skeleton"
    :class="[variant, { rounded }]"
    :style="{ width, height }"
  ></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  width?: string;
  height?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  rounded?: boolean;
}>(), {
  variant: 'text',
  rounded: false,
});
</script>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(15, 23, 42, 0.06) 25%,
    rgba(15, 23, 42, 0.12) 50%,
    rgba(15, 23, 42, 0.06) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton.text {
  height: 1em;
  border-radius: 4px;
}

.skeleton.circular {
  border-radius: 50%;
}

.skeleton.rectangular {
  border-radius: 0;
}

.skeleton.rounded {
  border-radius: 8px;
}
</style>
