import { Map, Record } from 'immutable'
import { LOBBY_INIT_DATA } from '../actions'

export const Player = new Record({
  name: null,
  id: null,
  race: 'r',
  isComputer: false,
  slot: -1
})
export const Lobby = new Record({
  name: null,
  map: null,
  numSlots: 0,
  players: new Map(),
  hostId: null,
})

const playersObjToMap = obj => {
  const records = Object.keys(obj).reduce((result, key) => {
    result[key] = new Player(obj[key])
    return result
  }, {})

  return new Map(records)
}

export default function lobbyReducer(state = new Lobby(), action) {
  switch (action.type) {
    case LOBBY_INIT_DATA:
      const data = action.payload
      return new Lobby({
        ...data,
        players: playersObjToMap(data.players)
      })
  }

  return state
}