const nameKey = (name) => name.trim().toLowerCase()

export function subtopicKey(topic, subtopic) {
  return JSON.stringify([topic, subtopic])
}

export function groupPDFProblems(problems, topics) {
  const topicGroups = new Map(topics.map((topic) => [
    nameKey(topic.name),
    {
      name: topic.name,
      count: 0,
      subtopics: new Map(topic.subtopics.map((name) => [nameKey(name), { name, problems: [] }])),
    },
  ]))

  for (const problem of problems) {
    const topicName = problem.user_topic?.trim() || problem.tags?.[0]?.trim() || 'Uncategorized'
    const subtopicName = problem.subtopic?.trim() || problem.user_subtopic?.trim() || 'General'
    const topicKey = nameKey(topicName)
    const sectionKey = nameKey(subtopicName)

    if (!topicGroups.has(topicKey)) {
      topicGroups.set(topicKey, { name: topicName, count: 0, subtopics: new Map() })
    }
    const topic = topicGroups.get(topicKey)
    if (!topic.subtopics.has(sectionKey)) {
      topic.subtopics.set(sectionKey, { name: subtopicName, problems: [] })
    }

    topic.subtopics.get(sectionKey).problems.push(problem)
    topic.count += 1
  }

  return Array.from(topicGroups.values())
    .filter((topic) => topic.count > 0)
    .map((topic) => ({
      ...topic,
      subtopics: Array.from(topic.subtopics.values()).filter((subtopic) => subtopic.problems.length > 0),
    }))
}
