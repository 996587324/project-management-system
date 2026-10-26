<template><ArtWangEditor v-model="text" height="240px" /></template>
<script setup lang="ts">
  import { ref } from 'vue'
  import ArtWangEditor from '../src/components/core/forms/art-wang-editor/index.vue'
  const text = ref('<p>首次加载 CommonJS 富文本依赖成功</p>')
</script>
