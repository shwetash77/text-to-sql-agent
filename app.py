import pandas as pd
import plotly.express as px
import streamlit as st
from agent import ask

st.set_page_config(page_title="Chat with your Database", page_icon="🗄️")
st.title("🗄️ Chat with your Database")
st.caption("Ask in plain English. The agent writes the SQL, runs it read-only, and shows the result.")


def auto_chart(df: pd.DataFrame):
    if df.empty or df.shape[1] < 2:
        return None
    x, y = df.columns[0], df.columns[1]
    if not pd.api.types.is_numeric_dtype(df[y]):
        return None
    if "date" in x.lower() or "month" in x.lower():
        return px.line(df, x=x, y=y, markers=True)
    return px.bar(df, x=x, y=y)


question = st.chat_input("e.g. Top 5 products by revenue in March 2025")
if question:
    st.chat_message("user").write(question)
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            answer, sql, df = ask(question)
        st.write(answer)
        if sql:
            with st.expander("SQL used"):
                st.code(sql, language="sql")
        if df is not None:
            st.dataframe(df, use_container_width=True)
            fig = auto_chart(df)
            if fig:
                st.plotly_chart(fig, use_container_width=True)
