import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
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
  const { enableTrafficLogger = true, trafficCardStatus = 'col-span-1' } = appConfig || {}
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
      <Tooltip content="记录流量统计" placement="top">
        <BorderSwitch
          isShowBorder={match && enableTrafficLogger}
          aria-label="记录流量统计"
          isSelected={enableTrafficLogger}
          onValueChange={(v) => patchAppConfig({ enableTrafficLogger: v })}
        />
      </Tooltip>
    </div>
  )

  if (iconOnly) {
    return (
      <div className={`${trafficCardStatus} flex justify-center`}>
        <Tooltip content="用量统计" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigate('/traffic')
            }}
          >
            <MdOutlineDataUsage className="text-[20px]" />
          </Button>
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
        fullWidth
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? 'scale-[0.95] tap-highlight-transparent' : ''}`}
      >
        <CardBody className="pb-1 pt-0 px-0 overflow-y-visible">
          <div className="flex justify-between items-start">
            <Button
              isIconOnly
              className="bg-transparent pointer-events-none"
              variant="flat"
              color="default"
            >
              <MdOutlineDataUsage
                color="default"
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
              />
            </Button>
            <div className="pt-2">{loggerSwitch}</div>
          </div>
        </CardBody>
        <CardFooter className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            用量统计
          </h3>
        </CardFooter>
      </Card>
    </div>
  )
}

export default React.memo(TrafficCard, (prevProps, nextProps) => {
  return prevProps.iconOnly === nextProps.iconOnly
})
