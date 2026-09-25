import { Button, Tooltip, Card } from '@heroui/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { useLocation, useNavigate } from 'react-router-dom'
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { MdOutlineDataUsage } from 'react-icons/md'

interface Props {
  iconOnly?: boolean
}

const TrafficCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const { appConfig, patchAppConfig } = useAppConfig()
  const { enableTrafficLogger = true, trafficCardStatus = 'col-span-1', disableAnimation = false } =
    appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/traffic')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({ id: 'traffic' })

  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  const loggerSwitch = (
    <div
      className="app-nodrag flex items-center"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tooltip delay={0}>
        <BorderSwitch
          isShowBorder={match && enableTrafficLogger}
          aria-label="记录流量统计"
          isSelected={enableTrafficLogger}
          onValueChange={(v) => patchAppConfig({ enableTrafficLogger: v })}
        />
        <Tooltip.Content placement="top">{'记录流量统计'}</Tooltip.Content>
      </Tooltip>
    </div>
  )

  if (iconOnly) {
    return (
      <div className={`${trafficCardStatus} flex justify-center`}>
        <Tooltip delay={0}>
          <Button
            size="sm"
            isIconOnly
            onPress={() => {
              navigate('/traffic')
            }}
            variant={match ? 'primary' : 'ghost'}
            data-color={match ? 'primary' : 'default'}
          >
            <MdOutlineDataUsage className="text-[20px]" />
          </Button>
          <Tooltip.Content placement="right">{'用量统计'}</Tooltip.Content>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${trafficCardStatus} traffic-card`}
    >
      <Card
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={[
          'w-full',
          `${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Card.Content className="pb-1 pt-0 px-0 overflow-y-visible">
          <div className="flex justify-between items-start">
            <Button
              isIconOnly
              variant="secondary"
              data-color="default"
              className="bg-transparent pointer-events-none"
            >
              <MdOutlineDataUsage
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
              />
            </Button>
            <div className="pt-2">{loggerSwitch}</div>
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            用量统计
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default React.memo(TrafficCard, (prevProps, nextProps) => {
  return prevProps.iconOnly === nextProps.iconOnly
})
