<template>
  <el-alert
    title="可视化映射配置"
    description="一个数据源组可以配置一个或多个字段。直接映射不改变原值；数值换算使用“原值 × 倍率 + 偏移量”；枚举转换用于状态码、开关量等文本替换。"
    type="info"
    show-icon
    :closable="false"
    class="config-help-alert"
  />

  <div v-if="groups.length" class="source-group-list">
    <section v-for="(group, groupIndex) in groups" :key="group.id" class="source-mapping-group">
      <header class="source-group-header">
        <strong>数据源组 {{ groupIndex + 1 }}</strong>
        <div class="source-group-actions">
          <el-tooltip content="复制数据源组" placement="top">
            <el-button
              text
              :icon="CopyDocument"
              aria-label="复制数据源组"
              @click="duplicateSourceGroup(groupIndex)"
            />
          </el-tooltip>
          <el-tooltip content="删除数据源组" placement="top">
            <el-button
              text
              type="danger"
              :icon="Delete"
              aria-label="删除数据源组"
              @click="removeSourceGroup(groupIndex)"
            />
          </el-tooltip>
        </div>
      </header>

      <el-form-item label="数据源标识">
        <el-select
          v-model="group.sourceId"
          filterable
          allow-create
          clearable
          default-first-option
          placeholder="输入或选择 sourceId，留空表示全部数据源"
        >
          <el-option
            v-for="sourceId in suggestions.sourceIds"
            :key="sourceId"
            :label="sourceId"
            :value="sourceId"
          />
        </el-select>
      </el-form-item>

      <div class="mapping-column-header">
        <span>源字段路径</span>
        <span>目标字段</span>
        <span>转换方式</span>
        <span>操作</span>
      </div>

      <div
        v-for="(mapping, mappingIndex) in group.mappings"
        :key="mapping.id"
        class="visual-mapping-row"
      >
        <el-autocomplete
          v-model="mapping.sourceField"
          :fetch-suggestions="createSourceFieldQuery(group.sourceId)"
          clearable
          highlight-first-item
          placeholder="选择订阅参数或直接输入路径"
          @select="fillTargetField(mapping)"
          @change="fillTargetField(mapping)"
        />
        <el-autocomplete
          v-model="mapping.targetField"
          :fetch-suggestions="createTargetFieldQuery(group.sourceId)"
          clearable
          highlight-first-item
          placeholder="选择已有字段或直接输入名称"
        />
        <el-select
          v-model="mapping.transformType"
          placeholder="选择转换方式"
          @change="handleTransformTypeChange(mapping)"
        >
          <el-option
            v-for="option in transformOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <div class="mapping-row-actions">
          <el-tooltip content="复制字段" placement="top">
            <el-button
              text
              :icon="CopyDocument"
              aria-label="复制字段"
              @click="duplicateMapping(groupIndex, mappingIndex)"
            />
          </el-tooltip>
          <el-tooltip content="删除字段" placement="top">
            <el-button
              text
              type="danger"
              :icon="Delete"
              aria-label="删除字段"
              @click="removeMapping(groupIndex, mappingIndex)"
            />
          </el-tooltip>
        </div>

        <div
          v-if="mapping.transformType === 'numeric' || mapping.transformType === 'enumNumeric'"
          class="mapping-transform-editor numeric-transform-editor"
        >
          <el-form-item label="倍率 factor">
            <el-input-number
              v-model="mapping.factor"
              :precision="6"
              :step="0.1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="偏移量 offset">
            <el-input-number
              v-model="mapping.offset"
              :precision="6"
              :step="0.1"
              controls-position="right"
            />
          </el-form-item>
          <span class="formula-preview">
            目标值 = 原值 × {{ mapping.factor }} + {{ mapping.offset }}
          </span>
        </div>

        <div
          v-if="mapping.transformType === 'enum' || mapping.transformType === 'enumNumeric'"
          class="mapping-transform-editor enum-transform-editor"
        >
          <div class="enum-map-header">
            <span>原始值</span>
            <span>转换后文本</span>
            <span>操作</span>
          </div>
          <div
            v-for="(entry, entryIndex) in mapping.enumEntries"
            :key="entry.id"
            class="enum-map-row"
          >
            <el-input v-model="entry.sourceValue" placeholder="例如 1" />
            <el-input v-model="entry.targetValue" placeholder="例如 运行" />
            <el-tooltip content="删除枚举值" placement="top">
              <el-button
                text
                type="danger"
                :icon="Delete"
                aria-label="删除枚举值"
                @click="removeEnumEntry(groupIndex, mappingIndex, entryIndex)"
              />
            </el-tooltip>
          </div>
          <el-button
            text
            type="primary"
            :icon="Plus"
            @click="addEnumEntry(groupIndex, mappingIndex)"
          >
            新增枚举值
          </el-button>
        </div>
      </div>

      <el-button text type="primary" :icon="Plus" @click="addMapping(groupIndex)">
        新增字段映射
      </el-button>
    </section>
  </div>

  <el-empty v-else description="还没有数据源组">
    <el-button type="primary" :icon="Plus" @click="addSourceGroup">新增数据源组</el-button>
  </el-empty>

  <div v-if="groups.length" class="visual-config-toolbar">
    <el-button :icon="Plus" @click="addSourceGroup">新增数据源组</el-button>
  </div>
</template>

<script setup lang="ts">
  import { CopyDocument, Delete, Plus } from '@element-plus/icons-vue'
  import type { AutocompleteFetchSuggestionsCallback } from 'element-plus'
  import {
    createEnumEntry,
    createVisualMapping,
    createVisualMappingGroup,
    type MappingSuggestions,
    type VisualMapping,
    type VisualMappingGroup
  } from './editorModel'

  const props = defineProps<{
    suggestions: MappingSuggestions
  }>()

  const groups = defineModel<VisualMappingGroup[]>({ required: true })

  const transformOptions = [
    { label: '直接映射', value: 'direct' },
    { label: '数值换算', value: 'numeric' },
    { label: '枚举转换', value: 'enum' },
    { label: '枚举优先 + 数值换算', value: 'enumNumeric' }
  ]

  const filterFields = (fields: string[], queryString: string) => {
    const keyword = queryString.trim().toLowerCase()
    return [...new Set(fields)]
      .filter((field) => !keyword || field.toLowerCase().includes(keyword))
      .sort()
      .map((value) => ({ value }))
  }

  const getSourceFields = (sourceId: string) => {
    const scopedFields = props.suggestions.sourceFieldsBySource[sourceId.trim().toLowerCase()] || []
    return scopedFields.length ? scopedFields : props.suggestions.sourceFields
  }

  const createSourceFieldQuery =
    (sourceId: string) => (queryString: string, callback: AutocompleteFetchSuggestionsCallback) => {
      callback(filterFields(getSourceFields(sourceId), queryString))
    }

  const createTargetFieldQuery =
    (sourceId: string) => (queryString: string, callback: AutocompleteFetchSuggestionsCallback) => {
      callback(
        filterFields([...props.suggestions.targetFields, ...getSourceFields(sourceId)], queryString)
      )
    }

  const fillTargetField = (mapping: VisualMapping) => {
    if (!mapping.targetField.trim() && mapping.sourceField.trim()) {
      mapping.targetField = mapping.sourceField.trim()
    }
  }

  const cloneMapping = (mapping: VisualMapping) =>
    createVisualMapping({
      sourceField: mapping.sourceField,
      targetField: mapping.targetField,
      transformType: mapping.transformType,
      factor: mapping.factor,
      offset: mapping.offset,
      enumEntries: mapping.enumEntries
    })

  const addSourceGroup = () => groups.value.push(createVisualMappingGroup())

  const duplicateSourceGroup = (groupIndex: number) => {
    const group = groups.value[groupIndex]
    if (!group) return
    const copy = createVisualMappingGroup(
      group.sourceId,
      group.mappings.map((mapping) => cloneMapping(mapping))
    )
    groups.value.splice(groupIndex + 1, 0, copy)
  }

  const removeSourceGroup = (groupIndex: number) => groups.value.splice(groupIndex, 1)

  const addMapping = (groupIndex: number) => {
    groups.value[groupIndex]?.mappings.push(createVisualMapping())
  }

  const duplicateMapping = (groupIndex: number, mappingIndex: number) => {
    const group = groups.value[groupIndex]
    const mapping = group?.mappings[mappingIndex]
    if (!group || !mapping) return
    group.mappings.splice(mappingIndex + 1, 0, cloneMapping(mapping))
  }

  const removeMapping = (groupIndex: number, mappingIndex: number) => {
    groups.value[groupIndex]?.mappings.splice(mappingIndex, 1)
  }

  const handleTransformTypeChange = (mapping: VisualMapping) => {
    if (
      (mapping.transformType === 'enum' || mapping.transformType === 'enumNumeric') &&
      !mapping.enumEntries.length
    ) {
      mapping.enumEntries.push(createEnumEntry())
    }
  }

  const addEnumEntry = (groupIndex: number, mappingIndex: number) => {
    groups.value[groupIndex]?.mappings[mappingIndex]?.enumEntries.push(createEnumEntry())
  }

  const removeEnumEntry = (groupIndex: number, mappingIndex: number, entryIndex: number) => {
    groups.value[groupIndex]?.mappings[mappingIndex]?.enumEntries.splice(entryIndex, 1)
  }
</script>
