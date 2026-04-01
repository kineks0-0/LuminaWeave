<template>
  <div class="lw-stepper">
    <button 
      class="stepper-btn minus" 
      @click="decrement" 
      :disabled="modelValue <= (min ?? -Infinity)"
      type="button"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    
    <input 
      type="number" 
      class="stepper-input" 
      :value="modelValue" 
      :min="min" 
      :max="max" 
      :step="step"
      @input="handleInput"
      @blur="handleBlur"
    />
    
    <button 
      class="stepper-btn plus" 
      @click="increment" 
      :disabled="modelValue >= (max ?? Infinity)"
      type="button"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
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
  align-items: center;
  background: var(--lw-bg-subtle);
  border-radius: 100px;
  border: 1px solid var(--lw-border-base);
  overflow: hidden;
  height: 32px;
  transition: all 0.2s ease;
}

.lw-stepper:focus-within {
  border-color: var(--lw-primary);
  box-shadow: 0 0 0 2px rgba(92, 115, 246, 0.1);
}

.stepper-btn {
  width: 32px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--lw-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--lw-bg-active);
  color: var(--lw-primary);
}

.stepper-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stepper-input {
  width: 50px;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--lw-text-main);
  outline: none;
  font-family: var(--lw-font-mono, monospace);
  -moz-appearance: textfield;
  appearance: none;
}

.stepper-input::-webkit-outer-spin-button,
.stepper-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.minus { border-right: 1px solid var(--lw-border-subtle); }
.plus { border-left: 1px solid var(--lw-border-subtle); }
</style>
