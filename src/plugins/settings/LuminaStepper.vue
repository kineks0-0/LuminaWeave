<template>
  <div class="lw-stepper tw:inline-flex tw:min-h-9 tw:items-center tw:overflow-hidden tw:rounded-lw-pill tw:border tw:border-lw-border tw:bg-lw-subtle tw:focus-within:border-lw-primary tw:focus-within:bg-lw-surface tw:focus-within:shadow-[0_0_0_3px_rgba(92,139,246,0.12)]">
    <LuminaIconButton
      class="tw:rounded-none tw:border-r tw:border-lw-border-subtle"
      ariaLabel="减少数值"
      @click="decrement" 
      :disabled="modelValue <= (min ?? -Infinity)"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </LuminaIconButton>
    
    <input 
      type="number" 
      class="tw:h-full tw:w-[74px] tw:min-w-[74px] tw:border-0 tw:bg-transparent tw:px-2 tw:text-center tw:font-lw-main tw:text-sm tw:font-bold tw:leading-5 tw:tabular-nums tw:text-lw-text tw:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:tw:m-0 [&::-webkit-inner-spin-button]:tw:appearance-none [&::-webkit-outer-spin-button]:tw:m-0 [&::-webkit-outer-spin-button]:tw:appearance-none"
      :value="modelValue" 
      :min="min" 
      :max="max" 
      :step="step"
      @input="handleInput"
      @blur="handleBlur"
    />
    
    <LuminaIconButton
      class="tw:rounded-none tw:border-l tw:border-lw-border-subtle"
      ariaLabel="增加数值"
      @click="increment" 
      :disabled="modelValue >= (max ?? Infinity)"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </LuminaIconButton>
  </div>
</template>

<script setup lang="ts">
import { LuminaIconButton } from '../../ui/primitives';

const props = defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits(['update:modelValue', 'change']);

const increment = () => {
  const next = props.modelValue + (props.step || 1);
  updateValue(next);
};

const decrement = () => {
  const next = props.modelValue - (props.step || 1);
  updateValue(next);
};

const handleInput = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (!isNaN(val)) {
    emit('update:modelValue', val);
  }
};

const handleBlur = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (isNaN(val)) {
    updateValue(props.min || 0);
  } else {
    updateValue(val);
  }
};

const updateValue = (val: number) => {
  let clamped = val;
  if (props.min !== undefined) clamped = Math.max(props.min, clamped);
  if (props.max !== undefined) clamped = Math.min(props.max, clamped);
  
  emit('update:modelValue', clamped);
  emit('change', clamped);
};
</script>

<style scoped>
.lw-stepper {
  display: inline-flex;
  width: auto;
}

/* 某些浏览器不吃 Tailwind 的 spinner 变体，这里兜底隐藏原生数字箭头 */
.lw-stepper input::-webkit-outer-spin-button,
.lw-stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.lw-stepper input {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
