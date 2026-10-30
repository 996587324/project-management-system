import type { WorkGroup } from '@/api/work-tasks'
import type { WorkChoice } from '@/components/business/work-choice-picker/types'

export function workGroupChoices(groups: WorkGroup[]): WorkChoice[] {
  return groups.map((group) => {
    const path = [group.name]
    const visited = new Set([group.id])
    let parent = groups.find((x) => x.id === group.parentId)
    while (parent && !visited.has(parent.id)) {
      path.unshift(parent.name)
      visited.add(parent.id)
      parent = groups.find((x) => x.id === parent?.parentId)
    }
    return {
      value: group.id,
      label: group.name,
      description: path.join(' / '),
      disabled: !group.enabled,
      reason: group.enabled ? '' : '工作组已停用'
    }
  })
}
