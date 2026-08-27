<template>
  <section :class="['robot-line-scene', { 'robot-line-scene--editable': editable }]">
    <div ref="canvasRef" class="robot-line-scene__canvas" />

    <div class="robot-line-scene__legend" aria-label="机械手状态图例">
      <span v-for="item in statusLegend" :key="item.status" class="robot-line-scene__legend-item">
        <i :style="{ backgroundColor: item.color }" />{{ item.label }}
      </span>
    </div>

    <div v-if="showDetail && !editable && selectedRobot" class="robot-line-scene__detail">
      <div class="robot-line-scene__detail-heading">
        <span class="robot-line-scene__detail-name">{{ selectedRobot.name }}</span>
        <span
          class="robot-line-scene__detail-status"
          :style="{ color: getStatusMeta(selectedRobot.status).color }"
        >
          {{ getStatusMeta(selectedRobot.status).label }}
        </span>
      </div>
      <p>{{ selectedRobot.station }}</p>
      <div v-if="selectedDisplayFields.length" class="robot-line-scene__detail-fields">
        <div v-for="field in selectedDisplayFields" :key="field.fieldCode">
          <span>{{ field.displayName }}</span>
          <b :title="formatDisplayField(field)">{{ formatDisplayField(field) }}</b>
        </div>
      </div>
      <p v-else class="robot-line-scene__detail-empty">暂无展示字段数据</p>
      <p v-if="selectedRobot.currentAlarm" class="robot-line-scene__detail-alarm">
        {{ selectedRobot.currentAlarm }}
      </p>
    </div>

    <span class="robot-line-scene__tip">
      {{
        editable
          ? '点击组件后拖动坐标轴移动 · 输送线端点可在右侧调整'
          : '拖拽旋转 · 滚轮缩放 · 点击机械手查看详情'
      }}
    </span>
  </section>
</template>

<script lang="ts">
  import { computed, defineComponent, onBeforeUnmount, onMounted, PropType, ref, watch } from 'vue'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
  import {
    ConveyorLayoutItem,
    JunctionLayoutItem,
    LayoutItemType,
    ProductionLineLayout,
    ROBOT_STATUS_META,
    RobotDevice,
    RobotStatus,
    WorkCellLayoutItem
  } from '@/views/production-dashboard/config/robotLine'
  import { LayoutMove, LayoutSelection } from '@/store/modules/production-dashboard'
  import type { DashboardRobotRuntime, DashboardRuntimeField } from '@/api/edge-dashboard'

  interface RobotNode {
    group: THREE.Group
    arm: THREE.Group
    marker: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>
    label: THREE.Sprite
    status: RobotStatus
  }

  interface SceneItemMetadata extends LayoutSelection {
    center: [number, number]
  }

  const statusLegend: RobotStatus[] = ['RUNNING', 'STOPPED', 'WARNING', 'ALARM']

  export default defineComponent({
    name: 'RobotLineScene',
    props: {
      robots: {
        type: Array as PropType<RobotDevice[]>,
        required: true
      },
      layout: {
        type: Object as PropType<ProductionLineLayout>,
        required: true
      },
      selectedId: {
        type: String,
        default: ''
      },
      runtimeRobots: {
        type: Array as PropType<DashboardRobotRuntime[]>,
        default: () => []
      },
      editable: {
        type: Boolean,
        default: false
      },
      showDetail: {
        type: Boolean,
        default: true
      }
    },
    emits: ['select', 'select-layout', 'move-layout-item'],
    setup(props, { emit }) {
      const canvasRef = ref<HTMLDivElement | null>(null)
      const scene = new THREE.Scene()
      const layoutLayer = new THREE.Group()
      const robotNodes = new Map<string, RobotNode>()
      const clickTargets: THREE.Object3D[] = []
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()
      const timer = new THREE.Timer()
      let renderer: THREE.WebGLRenderer | null = null
      let camera: THREE.PerspectiveCamera | null = null
      let controls: OrbitControls | null = null
      let focusTarget: THREE.Vector3 | null = null
      let transformControls: TransformControls | null = null
      let resizeObserver: ResizeObserver | null = null
      let animationFrame = 0
      let pointerDown: { x: number; y: number } | null = null
      let transformStart: [number, number] | null = null

      const selectedRobot = computed<RobotDevice | undefined>(
        () => props.robots.find((robot) => robot.id === props.selectedId) || props.robots[0]
      )
      const selectedRuntime = computed(() =>
        props.runtimeRobots.find((robot) => robot.robotCode === selectedRobot.value?.id)
      )
      const selectedDisplayFields = computed(() =>
        [...(selectedRuntime.value?.fields || [])].sort((left, right) => left.sort - right.sort)
      )

      const getStatusMeta = (status: RobotStatus) => ROBOT_STATUS_META[status]
      const formatDisplayField = (field: DashboardRuntimeField) => {
        const value = field.displayValue
        if (value == null || value === '') return '-'
        const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
        if (!field.unit) return text
        return field.unit === '%' ? `${text}%` : `${text} ${field.unit}`
      }

      /** 平滑移动观察中心，让自动巡检和手动选中的机械手保持在画面中央。 */
      const focusSelectedRobot = () => {
        if (props.editable || !controls) return
        const node = robotNodes.get(props.selectedId)
        if (!node) return
        focusTarget = new THREE.Vector3(node.group.position.x, 0.65, node.group.position.z)
      }

      const cancelFocus = () => {
        focusTarget = null
      }

      const createLabel = (text: string, color: string) => {
        const canvas = document.createElement('canvas')
        canvas.width = 768
        canvas.height = 152
        const context = canvas.getContext('2d')
        if (!context) return new THREE.Sprite()

        context.fillStyle = 'rgba(5, 15, 30, 0.82)'
        context.strokeStyle = color
        context.lineWidth = 6
        context.beginPath()
        context.rect(5, 5, canvas.width - 10, canvas.height - 10)
        context.fill()
        context.stroke()
        context.fillStyle = '#e2f6ff'
        context.font = 'bold 62px Arial, Microsoft YaHei, sans-serif'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(text, canvas.width / 2, canvas.height / 2 + 4)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: texture, transparent: true })
        )
        sprite.scale.set(2.05, 0.41, 1)
        return sprite
      }

      /** 在低显示缩放比例的大屏看板中放大机器人标识，编辑器仍保持原尺寸。 */
      const applyRobotLabelScale = (label: THREE.Sprite) => {
        const readableDashboard =
          !props.editable &&
          window.devicePixelRatio <= 1.1 &&
          window.innerWidth >= 1440 &&
          window.innerHeight >= 760
        label.scale.set(readableDashboard ? 2.65 : 2.05, readableDashboard ? 0.53 : 0.41, 1)
      }

      const disposeObject = (object: THREE.Object3D) => {
        object.traverse((child) => {
          const mesh = child as THREE.Mesh
          mesh.geometry?.dispose?.()
          const material = mesh.material as THREE.Material | THREE.Material[] | undefined
          const disposeMaterial = (item: THREE.Material) => {
            const texture = (item as THREE.MeshBasicMaterial).map
            texture?.dispose?.()
            item.dispose()
          }
          if (Array.isArray(material)) material.forEach(disposeMaterial)
          else if (material) disposeMaterial(material)
        })
      }

      const registerSelectable = (
        object: THREE.Object3D,
        type: LayoutItemType,
        id: string,
        center: [number, number]
      ) => {
        object.userData.layoutItem = { type, id, center } as SceneItemMetadata
        clickTargets.push(object)
      }

      const createBeam = (from: THREE.Vector3, to: THREE.Vector3, color: number) => {
        const direction = new THREE.Vector3().subVectors(to, from)
        const geometry = new THREE.CylinderGeometry(0.14, 0.18, direction.length(), 10)
        const material = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.24 })
        const beam = new THREE.Mesh(geometry, material)
        beam.position.copy(from).add(to).multiplyScalar(0.5)
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
        return beam
      }

      const createRobot = (robot: RobotDevice) => {
        const meta = getStatusMeta(robot.status)
        const group = new THREE.Group()
        group.name = robot.name
        group.position.set(robot.position[0], 0, robot.position[1])
        group.rotation.y = robot.rotation

        const baseMaterial = new THREE.MeshStandardMaterial({
          color: 0x1e3650,
          metalness: 0.72,
          roughness: 0.28
        })
        const casingMaterial = new THREE.MeshStandardMaterial({
          color: 0xf6a928,
          metalness: 0.45,
          roughness: 0.26
        })
        const jointMaterial = new THREE.MeshStandardMaterial({
          color: 0x0a1728,
          metalness: 0.9,
          roughness: 0.2
        })

        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.52, 0.18, 24),
          baseMaterial
        )
        pedestal.position.y = 0.09
        group.add(pedestal)

        const arm = new THREE.Group()
        arm.position.y = 0.18
        const shoulder = new THREE.Vector3(0, 0.44, 0)
        const elbow = new THREE.Vector3(0.68, 1.08, 0.08)
        const wrist = new THREE.Vector3(1.18, 0.72, -0.32)
        const tool = new THREE.Vector3(1.48, 0.64, -0.48)
        arm.add(createBeam(shoulder, elbow, 0xf6a928))
        arm.add(createBeam(elbow, wrist, 0xf6a928))
        arm.add(createBeam(wrist, tool, 0x9fb4c6))
        ;[shoulder, elbow, wrist].forEach((point, index) => {
          const joint = new THREE.Mesh(
            new THREE.SphereGeometry(index === 0 ? 0.26 : 0.2, 20, 16),
            index === 0 ? casingMaterial : jointMaterial
          )
          joint.position.copy(point)
          arm.add(joint)
        })
        const gripper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.25), jointMaterial)
        gripper.position.copy(tool)
        gripper.rotation.y = -0.45
        arm.add(gripper)
        group.add(arm)

        const markerMaterial = new THREE.MeshStandardMaterial({
          color: meta.color,
          emissive: meta.color,
          emissiveIntensity: 1.25,
          metalness: 0.25,
          roughness: 0.35
        })
        const marker = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 10, 36), markerMaterial)
        marker.rotation.x = -Math.PI / 2
        marker.position.y = 0.045
        group.add(marker)

        const label = createLabel(`${robot.name}  ${meta.label}`, meta.color)
        applyRobotLabelScale(label)
        label.position.set(0, 2.08, 0)
        group.add(label)
        scene.add(group)
        registerSelectable(group, 'robot', robot.id, robot.position)
        robotNodes.set(robot.id, { group, arm, marker, label, status: robot.status })
      }

      const removeRobot = (id: string) => {
        const node = robotNodes.get(id)
        if (!node) return
        transformControls?.detach()
        node.group.parent?.remove(node.group)
        const index = clickTargets.indexOf(node.group)
        if (index >= 0) clickTargets.splice(index, 1)
        disposeObject(node.group)
        robotNodes.delete(id)
      }

      const syncRobots = () => {
        const activeIds = new Set(props.robots.map((robot) => robot.id))
        Array.from(robotNodes.keys()).forEach((id) => {
          if (!activeIds.has(id)) removeRobot(id)
        })
        props.robots.forEach((robot) => {
          const node = robotNodes.get(robot.id)
          if (!node) {
            createRobot(robot)
            return
          }
          const meta = getStatusMeta(robot.status)
          node.group.position.set(robot.position[0], 0, robot.position[1])
          node.group.rotation.y = robot.rotation
          node.marker.material.color.set(meta.color)
          node.marker.material.emissive.set(meta.color)
          const metadata = node.group.userData.layoutItem as SceneItemMetadata
          metadata.center = [...robot.position]
          if (node.status !== robot.status) {
            const labelMaterial = node.label.material as THREE.SpriteMaterial
            labelMaterial.map?.dispose()
            labelMaterial.dispose()
            node.group.remove(node.label)
            node.label = createLabel(`${robot.name}  ${meta.label}`, meta.color)
            applyRobotLabelScale(node.label)
            node.label.position.set(0, 2.08, 0)
            node.group.add(node.label)
            node.status = robot.status
          }
        })
      }

      const createConveyor = (conveyor: ConveyorLayoutItem) => {
        const [startX, startZ] = conveyor.from
        const [endX, endZ] = conveyor.to
        const length = Math.hypot(endX - startX, endZ - startZ)
        if (length < 0.1) return
        const group = new THREE.Group()
        const base = new THREE.Mesh(
          new THREE.BoxGeometry(length, 0.18, conveyor.width),
          new THREE.MeshStandardMaterial({ color: 0x274764, metalness: 0.65, roughness: 0.32 })
        )
        base.position.y = 0.32
        group.add(base)
        const belt = new THREE.Mesh(
          new THREE.BoxGeometry(length - 0.18, 0.065, conveyor.width - 0.18),
          new THREE.MeshStandardMaterial({ color: 0x0f243a, metalness: 0.15, roughness: 0.7 })
        )
        belt.position.y = 0.46
        group.add(belt)
        for (let x = -length / 2 + 0.35; x < length / 2; x += 0.45) {
          const roller = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, conveyor.width - 0.24, 10),
            new THREE.MeshStandardMaterial({ color: 0x7aa4c1, metalness: 0.8, roughness: 0.25 })
          )
          roller.rotation.x = Math.PI / 2
          roller.position.set(x, 0.51, 0)
          group.add(roller)
        }
        const center: [number, number] = [(startX + endX) / 2, (startZ + endZ) / 2]
        group.position.set(center[0], 0, center[1])
        group.rotation.y = Math.atan2(endZ - startZ, endX - startX)
        layoutLayer.add(group)
        registerSelectable(group, 'conveyor', conveyor.id, center)
      }

      const createJunction = (junction: JunctionLayoutItem) => {
        const group = new THREE.Group()
        const material = new THREE.MeshStandardMaterial({
          color: junction.kind === 'merge' ? 0x57d6ff : 0x00d9ff,
          emissive: 0x006b80,
          emissiveIntensity: 1.4,
          metalness: 0.55,
          roughness: 0.3
        })
        const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 24), material)
        disk.position.y = 0.53
        group.add(disk)
        const label = createLabel(junction.name, '#8defff')
        label.position.y = 0.95
        group.add(label)
        group.position.set(junction.position[0], 0, junction.position[1])
        layoutLayer.add(group)
        registerSelectable(group, 'junction', junction.id, junction.position)
      }

      const createWorkCell = (cell: WorkCellLayoutItem) => {
        const group = new THREE.Group()
        const frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(cell.width, 1.15, cell.depth)),
          new THREE.LineBasicMaterial({ color: 0xffca4d, transparent: true, opacity: 0.9 })
        )
        frame.position.y = 0.63
        group.add(frame)
        group.position.set(cell.position[0], 0, cell.position[1])
        group.rotation.y = cell.rotation
        layoutLayer.add(group)
        registerSelectable(group, 'workCell', cell.id, cell.position)
      }

      const clearLayout = () => {
        transformControls?.detach()
        while (layoutLayer.children.length) {
          const child = layoutLayer.children[0]
          layoutLayer.remove(child)
          disposeObject(child)
        }
        for (let index = clickTargets.length - 1; index >= 0; index -= 1) {
          const item = clickTargets[index].userData.layoutItem as SceneItemMetadata | undefined
          if (item && item.type !== 'robot') clickTargets.splice(index, 1)
        }
      }

      const renderLayout = () => {
        clearLayout()
        props.layout.conveyors.forEach(createConveyor)
        props.layout.workCells.forEach(createWorkCell)
        props.layout.junctions.forEach(createJunction)
      }

      const createFactory = () => {
        scene.background = new THREE.Color(0x07111f)
        scene.fog = new THREE.Fog(0x07111f, 13, 31)
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(50, 50),
          new THREE.MeshStandardMaterial({ color: 0x0a2033, metalness: 0.15, roughness: 0.85 })
        )
        ground.rotation.x = -Math.PI / 2
        scene.add(ground)
        const grid = new THREE.GridHelper(50, 50, 0x214e6a, 0x123044)
        grid.position.y = 0.012
        scene.add(grid, layoutLayer)

        const ambient = new THREE.HemisphereLight(0x6db7ff, 0x07111f, 1.5)
        const keyLight = new THREE.DirectionalLight(0xc4ecff, 2.4)
        keyLight.position.set(4, 8, 6)
        const alarmLight = new THREE.PointLight(0xff765d, 16, 9, 2)
        alarmLight.position.set(3.37, 3, -0.94)
        scene.add(ambient, keyLight, alarmLight)
        renderLayout()
        syncRobots()
      }

      const resize = () => {
        if (!canvasRef.value || !renderer || !camera) return
        const { clientWidth, clientHeight } = canvasRef.value
        if (!clientWidth || !clientHeight) return
        camera.aspect = clientWidth / clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(clientWidth, clientHeight, false)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        robotNodes.forEach((node) => applyRobotLabelScale(node.label))
      }

      const getSceneItem = (object: THREE.Object3D) => {
        let target: THREE.Object3D | null = object
        while (target && !target.userData.layoutItem) target = target.parent
        return target || null
      }

      const selectSceneItem = (event: PointerEvent) => {
        if (!renderer || !camera || !canvasRef.value || !pointerDown) return
        if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6) return
        const bounds = canvasRef.value.getBoundingClientRect()
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1
        )
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(clickTargets, true)[0]
        if (!hit) return
        const target = getSceneItem(hit.object)
        const item = target?.userData.layoutItem as SceneItemMetadata | undefined
        if (!target || !item) return
        if (props.editable) {
          transformControls?.attach(target)
          emit('select-layout', { type: item.type, id: item.id } as LayoutSelection)
        } else if (item.type === 'robot') {
          emit('select', item.id)
        }
      }

      const onTransformMouseDown = () => {
        const object = transformControls?.object
        if (object) transformStart = [object.position.x, object.position.z]
      }

      const onTransformObjectChange = () => {
        const object = transformControls?.object
        if (object) object.position.y = 0
      }

      const onTransformMouseUp = () => {
        const object = transformControls?.object
        const item = object?.userData.layoutItem as SceneItemMetadata | undefined
        if (!object || !item || !transformStart) return
        const position: [number, number] = [
          Math.round(object.position.x * 100) / 100,
          Math.round(object.position.z * 100) / 100
        ]
        const move: LayoutMove = { type: item.type, id: item.id, position }
        if (item.type === 'conveyor') {
          move.delta = [position[0] - transformStart[0], position[1] - transformStart[1]]
        }
        transformStart = null
        emit('move-layout-item', move)
      }

      const animate = (timestamp?: number) => {
        animationFrame = requestAnimationFrame(animate)
        timer.update(timestamp)
        const elapsed = timer.getElapsed()
        props.robots.forEach((robot) => {
          const node = robotNodes.get(robot.id)
          if (!node) return
          const isAlert = robot.status === 'ALARM' || robot.status === 'WARNING'
          const isSelected = robot.id === props.selectedId
          const pulse = isAlert ? 1 + Math.sin(elapsed * 5) * 0.12 : 1
          node.marker.scale.setScalar(pulse * (isSelected ? 1.18 : 1))
          node.marker.material.emissiveIntensity = isSelected
            ? 2
            : isAlert
              ? 1.4 + Math.sin(elapsed * 5) * 0.7
              : 1.1
          if (robot.status === 'RUNNING') node.arm.rotation.y = Math.sin(elapsed * 1.8) * 0.16
        })
        if (camera && controls && focusTarget) {
          const nextTarget = controls.target.clone().lerp(focusTarget, 0.075)
          camera.position.add(nextTarget.clone().sub(controls.target))
          controls.target.copy(nextTarget)
          if (controls.target.distanceTo(focusTarget) < 0.015) focusTarget = null
        }
        controls?.update()
        renderer?.render(scene, camera as THREE.Camera)
      }

      const onPointerDown = (event: PointerEvent) => {
        pointerDown = { x: event.clientX, y: event.clientY }
      }

      const dispose = () => {
        cancelAnimationFrame(animationFrame)
        resizeObserver?.disconnect()
        if (canvasRef.value) {
          canvasRef.value.removeEventListener('pointerdown', onPointerDown)
          canvasRef.value.removeEventListener('pointerup', selectSceneItem)
        }
        controls?.removeEventListener('start', cancelFocus)
        controls?.dispose()
        transformControls?.dispose()
        timer.dispose()
        disposeObject(scene)
        renderer?.dispose()
        renderer?.domElement.remove()
        robotNodes.clear()
        clickTargets.splice(0)
      }

      onMounted(() => {
        if (!canvasRef.value) return
        timer.connect(document)
        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.outputColorSpace = THREE.SRGBColorSpace
        canvasRef.value.appendChild(renderer.domElement)
        camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
        camera.position.set(8.8, 10.5, 12.5)
        controls = new OrbitControls(camera, renderer.domElement)
        controls.target.set(0, 0.35, -0.55)
        controls.enableDamping = true
        controls.minDistance = 7
        controls.maxDistance = 25
        controls.maxPolarAngle = Math.PI / 2.05
        controls.addEventListener('start', cancelFocus)
        transformControls = new TransformControls(camera, renderer.domElement)
        transformControls.setMode('translate')
        transformControls.showY = false
        transformControls.addEventListener('dragging-changed', (event) => {
          if (controls) controls.enabled = !event.value
        })
        transformControls.addEventListener('mouseDown', onTransformMouseDown)
        transformControls.addEventListener('mouseUp', onTransformMouseUp)
        transformControls.addEventListener('objectChange', onTransformObjectChange)
        scene.add(transformControls.getHelper())
        createFactory()
        resize()
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(canvasRef.value)
        canvasRef.value.addEventListener('pointerdown', onPointerDown)
        canvasRef.value.addEventListener('pointerup', selectSceneItem)
        animate()
      })

      watch(
        () => props.robots,
        () => syncRobots(),
        { deep: true }
      )
      watch(
        () => props.layout,
        () => renderLayout(),
        { deep: true }
      )
      watch(
        () => props.editable,
        (editable) => {
          if (!editable) transformControls?.detach()
          robotNodes.forEach((node) => applyRobotLabelScale(node.label))
        }
      )
      watch(
        () => props.selectedId,
        () => focusSelectedRobot()
      )

      onBeforeUnmount(dispose)

      return {
        canvasRef,
        selectedRobot,
        selectedDisplayFields,
        formatDisplayField,
        getStatusMeta,
        statusLegend: statusLegend.map((status) => ({ status, ...getStatusMeta(status) }))
      }
    }
  })
</script>

<style lang="scss" scoped>
  .robot-line-scene {
    position: relative;
    height: 350px;
    overflow: hidden;
    background: #07111f;
    border: 1px solid rgb(75 183 246 / 35%);
    border-radius: 8px;

    &--editable {
      height: 100%;
    }

    &__canvas {
      width: 100%;
      height: 100%;
      cursor: grab;

      :deep(canvas) {
        display: block;
        width: 100%;
        height: 100%;
      }
    }

    &__canvas:active {
      cursor: grabbing;
    }

    &__legend,
    &__detail,
    &__tip {
      position: absolute;
      z-index: 1;
      color: #dceeff;
      pointer-events: none;
    }

    &__legend {
      top: 10px;
      left: 10px;
      display: flex;
      gap: 10px;
      padding: 6px 8px;
      font-size: 11px;
      background: rgb(4 15 30 / 74%);
      border: 1px solid rgb(124 210 255 / 20%);
      border-radius: 4px;
    }

    &__legend-item {
      display: flex;
      gap: 4px;
      align-items: center;

      i {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        box-shadow: 0 0 7px currentcolor;
      }
    }

    &__detail {
      top: 10px;
      right: 10px;
      width: min(340px, calc(100% - 20px));
      min-width: 220px;
      max-height: calc(100% - 64px);
      padding: 9px 11px;
      overflow: hidden auto;
      font-size: 12px;
      text-align: left;
      pointer-events: auto;
      background: rgb(4 15 30 / 78%);
      border-left: 2px solid #47c9ff;
      scrollbar-color: rgb(71 201 255 / 42%) transparent;
      scrollbar-width: thin;

      p {
        margin: 5px 0 0;
        color: #a6bed2;
      }
    }

    &__detail-heading {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }

    &__detail-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px 14px;
      padding-top: 7px;
      margin-top: 7px;
      border-top: 1px solid rgb(71 201 255 / 20%);

      div {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: space-between;
        min-width: 0;
        min-height: 24px;
      }

      span {
        overflow: hidden;
        color: #789aae;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      b {
        overflow: hidden;
        font-family: Consolas, monospace;
        font-weight: 600;
        color: #e7f7ff;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__detail-name {
      margin-right: 8px;
      font-weight: 700;
      color: #fff;
    }

    &__detail-status {
      font-weight: 700;
    }

    &__detail-alarm {
      color: #ff7b89 !important;
    }

    &__detail-empty {
      color: #617f91 !important;
    }

    &__tip {
      right: 12px;
      bottom: 9px;
      font-size: 11px;
      color: rgb(207 232 250 / 72%);
    }

    @media (width <= 767px) {
      &__detail {
        width: min(280px, calc(100% - 20px));
      }

      &__detail-fields {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
