<template>
  <section :class="['robot-line-scene', { 'robot-line-scene--editable': editable }]">
    <div ref="canvasRef" class="robot-line-scene__canvas" />

    <div class="robot-line-scene__legend" aria-label="设备与机械手状态图例">
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

    <div v-else-if="showDetail && !editable && selectedDevice" class="robot-line-scene__detail">
      <div class="robot-line-scene__detail-heading">
        <span class="robot-line-scene__detail-name">{{ selectedDevice.name }}</span>
        <span
          class="robot-line-scene__detail-status"
          :style="{ color: getDeviceStatusMeta(selectedDeviceRuntime).color }"
        >
          {{ getDeviceStatusMeta(selectedDeviceRuntime).label }}
        </span>
      </div>
      <p
        >{{ getDeviceTypeLabel(selectedDevice.deviceType) }} · 尺寸：{{ selectedDevice.width }} ×
        {{ selectedDevice.height }} × {{ selectedDevice.depth }}</p
      >
      <div v-if="selectedDeviceDisplayFields.length" class="robot-line-scene__detail-fields">
        <div v-for="field in selectedDeviceDisplayFields" :key="field.fieldCode">
          <span>{{ field.displayName }}</span>
          <b :title="formatDisplayField(field)">{{ formatDisplayField(field) }}</b>
        </div>
      </div>
      <p v-else class="robot-line-scene__detail-empty">暂无设备展示字段</p>
      <p v-if="selectedDeviceRuntime?.currentAlarm" class="robot-line-scene__detail-alarm">
        {{ selectedDeviceRuntime.currentAlarm }}
      </p>
    </div>

    <span class="robot-line-scene__tip">
      {{
        editable
          ? '点击组件后拖动坐标轴移动 · 输送线端点可在右侧调整'
          : '拖拽旋转 · 滚轮缩放 · 点击设备或机械手查看详情'
      }}
    </span>
  </section>
</template>

<script lang="ts">
  import {
    computed,
    defineComponent,
    nextTick,
    onBeforeUnmount,
    onMounted,
    PropType,
    ref,
    watch
  } from 'vue'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
  import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
  import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
  import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
  import {
    ConveyorLayoutItem,
    DeviceLayoutItem,
    DeviceLayoutType,
    JunctionLayoutItem,
    LayoutItemType,
    ProductionLineLayout,
    ROBOT_STATUS_META,
    RobotDevice,
    RobotStatus,
    WorkCellLayoutItem
  } from '@/views/production-dashboard/config/robotLine'
  import { LayoutMove, LayoutSelection } from '@/store/modules/production-dashboard'
  import type {
    DashboardDeviceRuntime,
    DashboardRobotRuntime,
    DashboardRuntimeField
  } from '@/api/edge-dashboard'

  interface RobotNode {
    group: THREE.Group
    arm: THREE.Group
    marker: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>
    label: THREE.Sprite
    status: RobotStatus
    name: string
  }

  interface DeviceNode {
    group: THREE.Group
    marker: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>
    statusPad: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
    label: THREE.Sprite
    status: RobotStatus
    name: string
    labelY: number
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
      selectedLayout: {
        type: Object as PropType<LayoutSelection | null>,
        default: null
      },
      runtimeRobots: {
        type: Array as PropType<DashboardRobotRuntime[]>,
        default: () => []
      },
      runtimeDevices: {
        type: Array as PropType<DashboardDeviceRuntime[]>,
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
    emits: ['select', 'select-scene', 'select-layout', 'move-layout-item'],
    setup(props, { emit }) {
      const canvasRef = ref<HTMLDivElement | null>(null)
      const scene = new THREE.Scene()
      const layoutLayer = new THREE.Group()
      const robotNodes = new Map<string, RobotNode>()
      const deviceNodes = new Map<string, DeviceNode>()
      const clickTargets: THREE.Object3D[] = []
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()
      const timer = new THREE.Timer()
      let renderer: THREE.WebGLRenderer | null = null
      let composer: EffectComposer | null = null
      let outlinePass: OutlinePass | null = null
      let camera: THREE.PerspectiveCamera | null = null
      let controls: OrbitControls | null = null
      let focusTarget: THREE.Vector3 | null = null
      let transformControls: TransformControls | null = null
      let resizeObserver: ResizeObserver | null = null
      let animationFrame = 0
      let pointerDown: { x: number; y: number } | null = null
      let transformStart: [number, number] | null = null

      const selectedSceneItem = computed<LayoutSelection | null>(
        () =>
          props.selectedLayout ||
          (props.selectedId ? { type: 'robot', id: props.selectedId } : null)
      )
      const selectedRobot = computed<RobotDevice | undefined>(() => {
        if (selectedSceneItem.value?.type !== 'robot') return undefined
        return props.robots.find((robot) => robot.id === selectedSceneItem.value?.id)
      })
      const selectedDevice = computed<DeviceLayoutItem | undefined>(() => {
        if (selectedSceneItem.value?.type !== 'device') return undefined
        return props.layout.devices.find((device) => device.id === selectedSceneItem.value?.id)
      })
      const selectedRuntime = computed(() =>
        props.runtimeRobots.find((robot) => robot.robotCode === selectedRobot.value?.id)
      )
      const selectedDeviceRuntime = computed(() =>
        props.runtimeDevices.find((device) => device.deviceCode === selectedDevice.value?.id)
      )
      const selectedDisplayFields = computed(() =>
        [...(selectedRuntime.value?.fields || [])].sort((left, right) => left.sort - right.sort)
      )
      const selectedDeviceDisplayFields = computed(() =>
        [...(selectedDeviceRuntime.value?.fields || [])].sort(
          (left, right) => left.sort - right.sort
        )
      )

      const getStatusMeta = (status: RobotStatus) => ROBOT_STATUS_META[status]
      const getDeviceStatus = (runtime?: DashboardDeviceRuntime): RobotStatus => {
        const status = runtime?.status as RobotStatus | undefined
        if (status && status in ROBOT_STATUS_META) return status
        return runtime?.dataOnline ? 'RUNNING' : 'OFFLINE'
      }
      const getDeviceStatusMeta = (runtime?: DashboardDeviceRuntime) =>
        getStatusMeta(getDeviceStatus(runtime))
      const getDeviceTypeLabel = (type: DeviceLayoutType) =>
        ({ generic: '通用设备', machine: '加工设备', inspection: '检测设备' })[type]
      const formatDisplayField = (field: DashboardRuntimeField) => {
        const value = field.displayValue
        if (value == null || value === '') return '-'
        const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
        if (!field.unit) return text
        return field.unit === '%' ? `${text}%` : `${text} ${field.unit}`
      }

      const findSceneItemObject = (selection: LayoutSelection | null) => {
        if (!selection) return undefined
        return clickTargets.find((object) => {
          const item = object.userData.layoutItem as SceneItemMetadata | undefined
          return item?.type === selection.type && item.id === selection.id
        })
      }

      /** 平滑移动观察中心，让手动选中的设备或机械手保持在画面中央。 */
      const focusSelectedSceneItem = () => {
        if (props.editable || !controls) return
        const target = findSceneItemObject(selectedSceneItem.value)
        if (!target) return
        focusTarget = new THREE.Vector3(target.position.x, 0.65, target.position.z)
      }

      const syncSelectionHighlight = () => {
        const target = findSceneItemObject(selectedSceneItem.value)
        if (outlinePass) outlinePass.selectedObjects = target ? [target] : []
        focusSelectedSceneItem()
      }

      const cancelFocus = () => {
        focusTarget = null
      }

      /**
       * 根据当前线体所有组件的占地范围生成全景视角。
       * 相机采用接近俯视的角度，并为工位框、设备尺寸与画面边缘预留空间。
       */
      const fitOverviewCamera = () => {
        if (!camera || !controls) return

        const bounds = new THREE.Box2()
        const include = (point: [number, number], paddingX = 0.8, paddingZ = paddingX) => {
          bounds.expandByPoint(new THREE.Vector2(point[0] - paddingX, point[1] - paddingZ))
          bounds.expandByPoint(new THREE.Vector2(point[0] + paddingX, point[1] + paddingZ))
        }

        props.robots.forEach((robot) => include(robot.position, 1.2))
        ;(props.layout.devices || []).forEach((device) =>
          include(device.position, Math.max(device.width / 2, 0.8), Math.max(device.depth / 2, 0.8))
        )
        props.layout.workCells.forEach((cell) =>
          include(cell.position, Math.max(cell.width / 2, 0.8), Math.max(cell.depth / 2, 0.8))
        )
        props.layout.conveyors.forEach((conveyor) => {
          const padding = Math.max(conveyor.width / 2, 0.5)
          include(conveyor.from, padding)
          include(conveyor.to, padding)
        })
        props.layout.junctions.forEach((junction) => include(junction.position, 0.8))

        if (bounds.isEmpty()) {
          include([-4, -3])
          include([4, 3])
        }

        const size = bounds.getSize(new THREE.Vector2())
        const center = bounds.getCenter(new THREE.Vector2())
        const paddedWidth = Math.max(size.x + 5, 10)
        const paddedDepth = Math.max(size.y + 5, 10)
        const aspect = Math.max(camera.aspect, 0.75)
        const visibleSpan = Math.max(paddedDepth, paddedWidth / aspect)
        const verticalFov = THREE.MathUtils.degToRad(camera.fov)
        const distance = Math.max(18, (visibleSpan / 2 / Math.tan(verticalFov / 2)) * 1.12)
        const overviewDirection = new THREE.Vector3(0.45, 1.35, 0.65).normalize()
        const target = new THREE.Vector3(center.x, 0.35, center.y)

        camera.position.copy(target).addScaledVector(overviewDirection, distance)
        camera.near = 0.1
        camera.far = 500
        camera.updateProjectionMatrix()
        controls.target.copy(target)
        // 保留全景浏览空间，同时允许靠近设备与工位框查看细节。
        controls.minDistance = Math.max(2.5, distance * 0.12)
        controls.maxDistance = Math.max(180, distance * 5)
        controls.minPolarAngle = 0.08
        controls.maxPolarAngle = Math.PI / 2.12
        focusTarget = null
        camera.lookAt(target)
        controls.update()
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
        let fontSize = 62
        context.font = `bold ${fontSize}px Arial, Microsoft YaHei, sans-serif`
        while (context.measureText(text).width > canvas.width - 72 && fontSize > 32) {
          fontSize -= 2
          context.font = `bold ${fontSize}px Arial, Microsoft YaHei, sans-serif`
        }
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
        robotNodes.set(robot.id, {
          group,
          arm,
          marker,
          label,
          status: robot.status,
          name: robot.name
        })
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
          if (node.status !== robot.status || node.name !== robot.name) {
            const labelMaterial = node.label.material as THREE.SpriteMaterial
            labelMaterial.map?.dispose()
            labelMaterial.dispose()
            node.group.remove(node.label)
            node.label = createLabel(`${robot.name}  ${meta.label}`, meta.color)
            applyRobotLabelScale(node.label)
            node.label.position.set(0, 2.08, 0)
            node.group.add(node.label)
            node.status = robot.status
            node.name = robot.name
          }
        })
        syncSelectionHighlight()
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

      const createDevice = (device: DeviceLayoutItem) => {
        const width = Math.max(device.width, 0.3)
        const height = Math.max(device.height, 0.3)
        const depth = Math.max(device.depth, 0.3)
        const group = new THREE.Group()
        group.name = device.name
        group.position.set(device.position[0], 0, device.position[1])
        group.rotation.y = device.rotation

        const bodyMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(device.color || '#4db7d8'),
          metalness: 0.58,
          roughness: 0.32
        })
        const darkMaterial = new THREE.MeshStandardMaterial({
          color: 0x102437,
          metalness: 0.72,
          roughness: 0.25
        })
        const accentMaterial = new THREE.MeshStandardMaterial({
          color: 0x63e8ff,
          emissive: 0x17677a,
          emissiveIntensity: 0.85,
          metalness: 0.25,
          roughness: 0.28
        })
        const status = getDeviceStatus(
          props.runtimeDevices.find((item) => item.deviceCode === device.id)
        )
        const statusMeta = getStatusMeta(status)

        const base = new THREE.Mesh(
          new THREE.BoxGeometry(width * 1.06, 0.12, depth * 1.06),
          darkMaterial
        )
        base.position.y = 0.06
        group.add(base)

        const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMaterial)
        body.position.y = height / 2 + 0.12
        group.add(body)

        if (device.deviceType === 'machine') {
          const door = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.64, height * 0.62, 0.045),
            darkMaterial
          )
          door.position.set(0, height * 0.48 + 0.12, depth / 2 + 0.025)
          group.add(door)
          const window = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.42, height * 0.24, 0.052),
            accentMaterial
          )
          window.position.set(0, height * 0.64 + 0.12, depth / 2 + 0.055)
          group.add(window)
        } else if (device.deviceType === 'inspection') {
          const screen = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.58, height * 0.34, 0.055),
            accentMaterial
          )
          screen.position.set(0, height * 0.62 + 0.12, depth / 2 + 0.03)
          group.add(screen)
          const sensor = new THREE.Mesh(
            new THREE.CylinderGeometry(width * 0.09, width * 0.09, depth * 0.36, 18),
            darkMaterial
          )
          sensor.rotation.x = Math.PI / 2
          sensor.position.set(0, height + 0.2, 0)
          group.add(sensor)
        } else {
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.5, height * 0.24, 0.05),
            darkMaterial
          )
          panel.position.set(0, height * 0.62 + 0.12, depth / 2 + 0.03)
          group.add(panel)
          const indicator = new THREE.Mesh(
            new THREE.SphereGeometry(Math.min(width, height) * 0.06, 16, 12),
            accentMaterial
          )
          indicator.position.set(width * 0.32, height * 0.78 + 0.12, depth / 2 + 0.07)
          group.add(indicator)
        }

        const markerMaterial = new THREE.MeshStandardMaterial({
          color: statusMeta.color,
          emissive: statusMeta.color,
          emissiveIntensity: 1.65,
          metalness: 0.28,
          roughness: 0.3
        })
        const statusPadMaterial = new THREE.MeshStandardMaterial({
          color: statusMeta.color,
          emissive: statusMeta.color,
          emissiveIntensity: 0.8,
          metalness: 0.22,
          roughness: 0.36
        })
        const statusPad = new THREE.Mesh(
          new THREE.BoxGeometry(width * 1.2, 0.07, depth * 1.2),
          statusPadMaterial
        )
        statusPad.position.y = 0.145
        group.add(statusPad)
        const marker = new THREE.Mesh(
          new THREE.TorusGeometry(Math.max(Math.max(width, depth) * 0.6, 0.58), 0.085, 10, 36),
          markerMaterial
        )
        marker.rotation.x = -Math.PI / 2
        marker.position.y = 0.23
        group.add(marker)

        const labelY = height + 0.62
        const label = createLabel(`${device.name}  ${statusMeta.label}`, statusMeta.color)
        label.position.y = labelY
        group.add(label)
        layoutLayer.add(group)
        registerSelectable(group, 'device', device.id, device.position)
        deviceNodes.set(device.id, {
          group,
          marker,
          statusPad,
          label,
          status,
          name: device.name,
          labelY
        })
      }

      const syncDevices = () => {
        props.layout.devices.forEach((device) => {
          const node = deviceNodes.get(device.id)
          if (!node) return
          const status = getDeviceStatus(
            props.runtimeDevices.find((item) => item.deviceCode === device.id)
          )
          const meta = getStatusMeta(status)
          node.marker.material.color.set(meta.color)
          node.marker.material.emissive.set(meta.color)
          node.statusPad.material.color.set(meta.color)
          node.statusPad.material.emissive.set(meta.color)
          if (node.status !== status || node.name !== device.name) {
            const labelMaterial = node.label.material as THREE.SpriteMaterial
            labelMaterial.map?.dispose()
            labelMaterial.dispose()
            node.group.remove(node.label)
            node.label = createLabel(`${device.name}  ${meta.label}`, meta.color)
            applyRobotLabelScale(node.label)
            node.label.position.y = node.labelY
            node.group.add(node.label)
            node.status = status
            node.name = device.name
          }
        })
      }

      const createWorkCell = (cell: WorkCellLayoutItem) => {
        const height = Math.max(cell.height, 0.3)
        const group = new THREE.Group()
        const frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(cell.width, height, cell.depth)),
          new THREE.LineBasicMaterial({ color: 0xffca4d, transparent: true, opacity: 0.9 })
        )
        frame.position.y = height / 2 + 0.06
        group.add(frame)
        const label = createLabel(cell.name, '#ffca4d')
        label.scale.set(1.8, 0.36, 1)
        label.position.y = height + 0.33
        group.add(label)
        group.position.set(cell.position[0], 0, cell.position[1])
        group.rotation.y = cell.rotation
        layoutLayer.add(group)
        registerSelectable(group, 'workCell', cell.id, cell.position)
      }

      const clearLayout = () => {
        transformControls?.detach()
        if (outlinePass) outlinePass.selectedObjects = []
        while (layoutLayer.children.length) {
          const child = layoutLayer.children[0]
          layoutLayer.remove(child)
          disposeObject(child)
        }
        for (let index = clickTargets.length - 1; index >= 0; index -= 1) {
          const item = clickTargets[index].userData.layoutItem as SceneItemMetadata | undefined
          if (item && item.type !== 'robot') clickTargets.splice(index, 1)
        }
        deviceNodes.clear()
      }

      const renderLayout = () => {
        clearLayout()
        props.layout.conveyors.forEach(createConveyor)
        ;(props.layout.devices || []).forEach(createDevice)
        props.layout.workCells.forEach(createWorkCell)
        props.layout.junctions.forEach(createJunction)
        syncDevices()
        syncSelectionHighlight()
      }

      const createFactory = () => {
        scene.background = new THREE.Color(0x1b4358)
        scene.fog = new THREE.Fog(0x1b4358, 90, 280)
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(600, 600),
          new THREE.MeshStandardMaterial({ color: 0x285a70, metalness: 0.12, roughness: 0.88 })
        )
        ground.rotation.x = -Math.PI / 2
        scene.add(ground)
        const grid = new THREE.GridHelper(600, 300, 0x62a8c1, 0x39778f)
        grid.position.y = 0.012
        scene.add(grid, layoutLayer)

        const ambient = new THREE.HemisphereLight(0xb5e7ff, 0x17394c, 1.9)
        const keyLight = new THREE.DirectionalLight(0xd9f3ff, 2.7)
        keyLight.position.set(4, 8, 6)
        const alarmLight = new THREE.PointLight(0xff765d, 16, 9, 2)
        alarmLight.position.set(3.37, 3, -0.94)
        scene.add(ambient, keyLight, alarmLight)
        renderLayout()
        syncRobots()
        syncDevices()
      }

      const resize = () => {
        if (!canvasRef.value || !renderer || !camera) return
        const { clientWidth, clientHeight } = canvasRef.value
        if (!clientWidth || !clientHeight) return
        camera.aspect = clientWidth / clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(clientWidth, clientHeight, false)
        const pixelRatio = Math.min(window.devicePixelRatio, 2)
        renderer.setPixelRatio(pixelRatio)
        composer?.setPixelRatio(pixelRatio)
        composer?.setSize(clientWidth, clientHeight)
        robotNodes.forEach((node) => applyRobotLabelScale(node.label))
        deviceNodes.forEach((node) => applyRobotLabelScale(node.label))
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
        if (!hit) {
          if (!props.editable) emit('select-scene', null)
          return
        }
        const target = getSceneItem(hit.object)
        const item = target?.userData.layoutItem as SceneItemMetadata | undefined
        if (!target || !item) return
        if (props.editable) {
          transformControls?.attach(target)
          emit('select-layout', { type: item.type, id: item.id } as LayoutSelection)
        } else if (item.type === 'robot' || item.type === 'device') {
          const selection = { type: item.type, id: item.id } as LayoutSelection
          emit('select-scene', selection)
          if (item.type === 'robot') emit('select', item.id)
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
          const isSelected =
            selectedSceneItem.value?.type === 'robot' && robot.id === selectedSceneItem.value.id
          const pulse = isAlert ? 1 + Math.sin(elapsed * 5) * 0.12 : 1
          node.marker.scale.setScalar(pulse * (isSelected ? 1.18 : 1))
          node.marker.material.emissiveIntensity = isSelected
            ? 2
            : isAlert
              ? 1.4 + Math.sin(elapsed * 5) * 0.7
              : 1.1
          if (robot.status === 'RUNNING') node.arm.rotation.y = Math.sin(elapsed * 1.8) * 0.16
        })
        props.layout.devices.forEach((device) => {
          const node = deviceNodes.get(device.id)
          if (!node) return
          const isAlert = node.status === 'ALARM' || node.status === 'WARNING'
          const isSelected =
            selectedSceneItem.value?.type === 'device' && device.id === selectedSceneItem.value.id
          const pulse = isAlert ? 1 + Math.sin(elapsed * 5) * 0.12 : 1
          node.marker.scale.setScalar(pulse * (isSelected ? 1.18 : 1))
          node.marker.material.emissiveIntensity = isSelected
            ? 2.5
            : isAlert
              ? 1.85 + Math.sin(elapsed * 5) * 0.95
              : 1.55
          node.statusPad.material.emissiveIntensity = isSelected
            ? 1.45
            : isAlert
              ? 1.05 + Math.sin(elapsed * 5) * 0.45
              : 0.8
        })
        if (camera && controls && focusTarget) {
          const nextTarget = controls.target.clone().lerp(focusTarget, 0.075)
          camera.position.add(nextTarget.clone().sub(controls.target))
          controls.target.copy(nextTarget)
          if (controls.target.distanceTo(focusTarget) < 0.015) focusTarget = null
        }
        controls?.update()
        if (composer) composer.render()
        else renderer?.render(scene, camera as THREE.Camera)
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
        outlinePass?.dispose()
        composer?.dispose()
        disposeObject(scene)
        renderer?.dispose()
        renderer?.domElement.remove()
        robotNodes.clear()
        deviceNodes.clear()
        clickTargets.splice(0)
      }

      onMounted(() => {
        if (!canvasRef.value) return
        timer.connect(document)
        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.outputColorSpace = THREE.SRGBColorSpace
        canvasRef.value.appendChild(renderer.domElement)
        camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500)
        camera.position.set(10, 20, 14)
        composer = new EffectComposer(renderer)
        composer.addPass(new RenderPass(scene, camera))
        outlinePass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera)
        outlinePass.edgeStrength = 5
        outlinePass.edgeGlow = 1.15
        outlinePass.edgeThickness = 1.6
        outlinePass.pulsePeriod = 1.8
        outlinePass.visibleEdgeColor.set('#63e8ff')
        outlinePass.hiddenEdgeColor.set('#1b6680')
        composer.addPass(outlinePass)
        controls = new OrbitControls(camera, renderer.domElement)
        controls.target.set(0, 0.35, -0.55)
        controls.enableDamping = true
        controls.minDistance = 2.5
        controls.maxDistance = 120
        controls.minPolarAngle = 0.08
        controls.maxPolarAngle = Math.PI / 2.12
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
        fitOverviewCamera()
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
        () => props.runtimeDevices,
        () => syncDevices(),
        { deep: true }
      )
      watch(
        () => props.layout.lineId,
        async () => {
          await nextTick()
          fitOverviewCamera()
        }
      )
      watch(
        () => props.editable,
        (editable) => {
          if (!editable) transformControls?.detach()
          robotNodes.forEach((node) => applyRobotLabelScale(node.label))
          deviceNodes.forEach((node) => applyRobotLabelScale(node.label))
          syncSelectionHighlight()
        }
      )
      watch(selectedSceneItem, () => syncSelectionHighlight(), { deep: true })

      onBeforeUnmount(dispose)

      return {
        canvasRef,
        selectedRobot,
        selectedDevice,
        selectedDeviceRuntime,
        selectedDisplayFields,
        selectedDeviceDisplayFields,
        formatDisplayField,
        getDeviceTypeLabel,
        getStatusMeta,
        getDeviceStatusMeta,
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
    background: #1b4358;
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
      background: rgb(26 67 88 / 84%);
      border: 1px solid rgb(144 218 248 / 28%);
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
      background: rgb(24 63 83 / 88%);
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
